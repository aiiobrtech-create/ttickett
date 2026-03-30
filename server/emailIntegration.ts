/**
 * Inbound webhook (Mailgun / JSON) e envio de respostas (Resend HTTP API).
 * Requer: SUPABASE_SERVICE_ROLE_KEY, EMAIL_WEBHOOK_SECRET, RESEND_API_KEY, EMAIL_FROM.
 */
import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqual, randomUUID } from "crypto";

export interface EmailIntegrationOptions {
  supabase: SupabaseClient;
  supabaseAnon: SupabaseClient;
}

function normEmail(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFromHeader(from: string): { name: string; email: string } {
  const raw = String(from || "").trim();
  const m = raw.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
  if (m) {
    return { name: (m[1] || m[2]).trim(), email: normEmail(m[2]) };
  }
  return { name: raw.split("@")[0] || "Solicitante", email: normEmail(raw) };
}

function extractTicketNumber(subject: string): string | null {
  const s = String(subject || "");
  const m = s.match(/\b(TK-\d+)\b/i);
  return m ? m[1].toUpperCase() : null;
}

function safeTimingEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function verifyWebhookSecret(req: Request): boolean {
  const secret = process.env.EMAIL_WEBHOOK_SECRET || "";
  if (!secret) {
    console.warn("[email/inbound] EMAIL_WEBHOOK_SECRET não configurado — webhook recusado.");
    return false;
  }
  const hdr = String(req.headers["x-ttickett-email-secret"] || "");
  if (hdr && safeTimingEqual(hdr, secret)) return true;
  const auth = String(req.headers.authorization || "");
  if (auth.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t && safeTimingEqual(t, secret)) return true;
  }
  return false;
}

/** Mailgun (form) ou JSON de teste / outros provedores. */
function parseInboundBody(req: Request): {
  to: string;
  from: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo: string;
} {
  const b = req.body as Record<string, unknown>;
  if (req.is("application/json")) {
    return {
      to: normEmail(String(b.to || b.recipient || "")),
      from: String(b.from || b.sender || ""),
      subject: String(b.subject || "(sem assunto)"),
      text: String(b.text || b["body-plain"] || b["stripped-text"] || ""),
      messageId: String(b.messageId || b["Message-Id"] || b["message-id"] || "").trim(),
      inReplyTo: String(b.inReplyTo || b["In-Reply-To"] || b["in-reply-to"] || "").trim(),
    };
  }
  return {
    to: normEmail(String(b.recipient || b.To || b.to || "")),
    from: String(b.sender || b.from || ""),
    subject: String(b.subject || "(sem assunto)"),
    text: String(b["body-plain"] || b["stripped-text"] || b.stripped_text || b.text || ""),
    messageId: String(b["Message-Id"] || b["message-id"] || "").trim(),
    inReplyTo: String(b["In-Reply-To"] || b["in-reply-to"] || "").trim(),
  };
}

type Msg = {
  id: string;
  author: string;
  authorRole: string;
  content: string;
  timestamp: string;
  isInternal?: boolean;
  source?: string;
  emailMessageId?: string;
  attachment?: unknown;
};

async function sendViaResend(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}): Promise<{ id: string; messageId: string }> {
  const key = process.env.RESEND_API_KEY || "";
  if (!key) throw new Error("RESEND_API_KEY ausente");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      headers: params.headers,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { id?: string; message_id?: string; messageId?: string };
  if (!res.ok) {
    const err = (data as { message?: string }).message || JSON.stringify(data);
    throw new Error(`Resend: ${err}`);
  }
  const messageId =
    (data.message_id as string) ||
    (data.messageId as string) ||
    `<${randomUUID()}@resend>`;
  return { id: data.id || "", messageId };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadUserForAuth(
  supabaseAnon: SupabaseClient,
  token: string
): Promise<{ id: string; role: string; companyId: string | null; organizationId: string | null } | null> {
  const { data: authData, error } = await supabaseAnon.auth.getUser(token);
  if (error || !authData?.user?.id) return null;
  const uid = authData.user.id;
  const { data: row, error: dbe } = await supabaseAnon
    .from("users")
    .select('id,role,"companyId","organizationId"')
    .eq("id", uid)
    .maybeSingle();
  if (dbe || !row) return null;
  return {
    id: String((row as any).id),
    role: String((row as any).role || ""),
    companyId: ((row as any).companyId as string | null) ?? null,
    organizationId: ((row as any).organizationId as string | null) ?? null,
  };
}

async function loadOrgIdsForUser(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("user_organizations")
    .select("organizationId")
    .eq("userId", userId);
  return (data || []).map((r: any) => r.organizationId).filter(Boolean);
}

async function userCanNotifyTicketByEmail(
  supabase: SupabaseClient,
  supabaseAnon: SupabaseClient,
  token: string,
  ticket: {
    companyId: string | null;
    organizationId: string | null;
    assignee: string | null;
  }
): Promise<boolean> {
  const u = await loadUserForAuth(supabaseAnon, token);
  if (!u) return false;
  if (u.role === "ttickett_admin") return true;
  if (!["agent", "admin"].includes(u.role)) return false;

  const tComp = ticket.companyId;
  const tOrg = ticket.organizationId;
  const assignee = ticket.assignee;

  if (u.role === "admin") {
    if (!tComp || u.companyId !== tComp) return false;
    return true;
  }

  if (u.role === "agent") {
    if (assignee && assignee === (await loadUserName(supabase, u.id))) {
      /* nome conferido abaixo com escopo */
    } else if (assignee) {
      return false;
    }
    const legacyOrg = u.organizationId;
    const multi = await loadOrgIdsForUser(supabase, u.id);
    const scopeOrgIds = multi.length ? multi : legacyOrg ? [legacyOrg] : [];
    if (scopeOrgIds.length) {
      return !!tOrg && scopeOrgIds.includes(tOrg);
    }
    if (u.companyId) return tComp === u.companyId;
    return true;
  }

  return false;
}

async function loadUserName(supabase: SupabaseClient, id: string): Promise<string> {
  const { data } = await supabase.from("users").select("name").eq("id", id).maybeSingle();
  return String((data as any)?.name || "");
}

export function registerEmailRoutes(app: Express, opts: EmailIntegrationOptions): void {
  const { supabase, supabaseAnon } = opts;

  app.post("/api/email/inbound", async (req: Request, res: Response) => {
    if (!verifyWebhookSecret(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = parseInboundBody(req);
    if (!parsed.to || !parsed.from) {
      return res.status(400).json({ error: "to e from são obrigatórios." });
    }

    const { data: allCompanies, error: cErr } = await supabase
      .from("companies")
      .select('id,name,"supportEmail","defaultOrganizationId","emailFromName"');

    if (cErr) {
      console.error("[email/inbound] company:", cErr);
      return res.status(500).json({ error: cErr.message });
    }
    const companyRow = (allCompanies || []).find((c: any) => normEmail(c.supportEmail || "") === parsed.to);
    if (!companyRow) {
      console.warn("[email/inbound] Nenhuma empresa para o endereço", parsed.to);
      return res.status(404).json({ error: "Empresa não encontrada para este endereço." });
    }

    const company = companyRow as any;
    const companyId: string = company.id;
    const { name: reqName, email: reqEmail } = parseFromHeader(parsed.from);
    if (!reqEmail) {
      return res.status(400).json({ error: "Remetente inválido." });
    }

    let bodyText = parsed.text?.trim();
    if (!bodyText && req.body && (req.body as any)["body-html"]) {
      bodyText = stripHtml(String((req.body as any)["body-html"]));
    }
    if (!bodyText) bodyText = "(sem conteúdo de texto)";

    const ticketNumber = extractTicketNumber(parsed.subject);
    let existing: any = null;
    if (ticketNumber) {
      const { data: t } = await supabase
        .from("tickets")
        .select("*")
        .eq("number", ticketNumber)
        .eq("companyId", companyId)
        .maybeSingle();
      existing = t;
    }

    const mid = parsed.messageId || "";
    const newMsg: Msg = {
      id: `em${Date.now()}`,
      author: reqName,
      authorRole: "client",
      content: bodyText,
      timestamp: new Date().toISOString(),
      isInternal: false,
      source: "email",
      emailMessageId: mid || undefined,
    };

    if (existing) {
      const msgs = Array.isArray(existing.messages) ? [...existing.messages] : [];
      if (mid && msgs.some((m: any) => m.emailMessageId === mid)) {
        return res.status(200).json({ ok: true, duplicate: true });
      }
      msgs.push(newMsg);
      const { error: upErr } = await supabase
        .from("tickets")
        .update({
          messages: msgs,
          updatedAt: new Date().toISOString(),
          emailLastMessageId: mid || existing.emailLastMessageId,
        })
        .eq("id", existing.id);
      if (upErr) {
        console.error("[email/inbound] update", upErr);
        return res.status(500).json({ error: upErr.message });
      }
      return res.status(200).json({ ok: true, ticketId: existing.id, updated: true });
    }

    let orgId: string | null = company.defaultOrganizationId || null;
    if (orgId) {
      const { data: orgCheck } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", orgId)
        .eq("companyId", companyId)
        .maybeSingle();
      if (!orgCheck) orgId = null;
    }
    if (!orgId) {
      const { data: firstOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("companyId", companyId)
        .order("name")
        .limit(1)
        .maybeSingle();
      orgId = firstOrg?.id || null;
    }
    if (!orgId) {
      return res.status(400).json({
        error:
          "Nenhuma organização vinculada à empresa. Cadastre uma organização ou defina a organização padrão na empresa.",
      });
    }

    const { data: numRow, error: numErr } = await supabase.rpc("next_ticket_number");
    if (numErr || !numRow) {
      console.error("[email/inbound] next_ticket_number", numErr);
      return res.status(500).json({ error: numErr?.message || "Falha ao gerar número do ticket." });
    }
    const number = String(numRow);

    const rootMid = mid || `<${randomUUID()}@inbound.tticket>`;
    const insertPayload = {
      number,
      requester: reqName,
      requesterEmail: reqEmail,
      requesterUid: null,
      organizationId: orgId,
      companyId,
      platform: "E-mail",
      category: null,
      subject: parsed.subject.replace(/^\s*Re:\s*/i, "").trim() || "(sem assunto)",
      description: bodyText.slice(0, 2000),
      status: "Aberto",
      urgency: "Média",
      assignee: null,
      messages: [newMsg],
      source: "email",
      emailRootMessageId: rootMid,
      emailLastMessageId: mid || rootMid,
    };

    const { data: ins, error: insErr } = await supabase.from("tickets").insert(insertPayload).select("id").single();
    if (insErr) {
      console.error("[email/inbound] insert", insErr);
      return res.status(500).json({ error: insErr.message });
    }
    return res.status(200).json({ ok: true, ticketId: ins.id, created: true });
  });

  app.post("/api/email/send-ticket-reply", async (req: Request, res: Response) => {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return res.status(401).json({ error: "Token ausente." });

    const ticketId = String(req.body?.ticketId || "").trim();
    const content = String(req.body?.content || "").trim();
    if (!ticketId || !content) {
      return res.status(400).json({ error: "ticketId e content são obrigatórios." });
    }

    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .select(
        'id,number,subject,"requesterEmail","companyId","organizationId",assignee,"emailRootMessageId","emailLastMessageId"'
      )
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr || !ticket) {
      return res.status(404).json({ error: "Ticket não encontrado." });
    }

    const t = ticket as any;
    const ok = await userCanNotifyTicketByEmail(supabase, supabaseAnon, token, {
      companyId: t.companyId ?? null,
      organizationId: t.organizationId ?? null,
      assignee: t.assignee ?? null,
    });
    if (!ok) return res.status(403).json({ error: "Sem permissão para enviar e-mail deste ticket." });

    const to = String(t.requesterEmail || "").trim();
    if (!to) return res.status(400).json({ error: "Ticket sem e-mail do solicitante." });

    const { data: company } = await supabase
      .from("companies")
      .select('"supportEmail","emailFromName",name')
      .eq("id", t.companyId || "")
      .maybeSingle();

    const c = company as any;
    const supportMailbox = String(c?.supportEmail || "").trim();
    const envFrom = String(process.env.EMAIL_FROM || "").trim();
    const displayName = String(c?.emailFromName || c?.name || "Suporte").trim();
    const fromHdr =
      envFrom ||
      (supportMailbox ? `${displayName} <${supportMailbox}>` : "");
    if (!fromHdr) {
      return res.status(500).json({
        error:
          "Defina o e-mail de suporte na empresa e/ou EMAIL_FROM no servidor (domínio verificado no Resend).",
      });
    }
    const subject = `[${t.number}] ${t.subject || "Ticket"}`;

    const replyToMid = String(t.emailLastMessageId || t.emailRootMessageId || "").trim();
    const refs = [t.emailRootMessageId, t.emailLastMessageId].filter(Boolean).join(" ");

    const newMsgId = `<${randomUUID()}@ttickett>`;

    const headers: Record<string, string> = {
      "Message-ID": newMsgId,
    };
    if (replyToMid) {
      headers["In-Reply-To"] = replyToMid;
      headers["References"] = refs || replyToMid;
    }
    if (envFrom && supportMailbox) {
      headers["Reply-To"] = `${displayName} <${supportMailbox}>`;
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn("[email/send] RESEND_API_KEY ausente — e-mail não enviado.");
      return res.status(503).json({
        error: "Envio de e-mail não configurado (RESEND_API_KEY).",
      });
    }

    try {
      const html = `<p>${escapeHtml(content).replace(/\n/g, "<br/>")}</p><p style="color:#666;font-size:12px">Ref: ${escapeHtml(t.number)}</p>`;
      const sendResult = await sendViaResend({
        from: fromHdr,
        to,
        subject,
        html,
        text: `${content}\n\n— ${t.number}`,
        headers,
      });

      const outMid = sendResult.messageId || newMsgId;

      const { error: upErr } = await supabase
        .from("tickets")
        .update({
          emailRootMessageId: t.emailRootMessageId || outMid,
          emailLastMessageId: outMid,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", ticketId);

      if (upErr) console.error("[email/send] meta update", upErr);

      return res.status(200).json({ ok: true, sent: true, providerId: sendResult.id });
    } catch (e: any) {
      console.error("[email/send]", e?.message || e);
      return res.status(500).json({ error: e?.message || "Falha ao enviar e-mail." });
    }
  });
}
