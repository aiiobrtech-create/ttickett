import express from "express";
import type { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import fs from "fs";
import { exec } from "child_process";

import { createClient } from "@supabase/supabase-js";
import { registerEmailRoutes } from "./server/emailIntegration";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// override: true — senão um PORT vindo do terminal/IDE (ex.: 3020) ignora PORT=3000 do .env
dotenv.config({ override: true });

const uploadsDir = path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn("[Server] Não foi possível criar a pasta uploads/", e);
}

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl || !supabaseKey) {
  console.error(
    [
      "[Backend] Variáveis do Supabase ausentes.",
      "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (recomendado) ou SUPABASE_ANON_KEY.",
      "Dica: no frontend use VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    ].join(" ")
  );
}

const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder");
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabaseAnon = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  anonKey || "placeholder",
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// Test Supabase connection on startup
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error) {
      console.warn("Backend Supabase connection warning:", error.message);
    } else {
      console.log("Backend Supabase connection successful.");
    }
  } catch (err) {
    console.error("Backend Supabase connection failed:", err);
  }
}
testSupabaseConnection();

const app = express();
/** Sempre a porta do `.env` / padrão 3000 — não troca sozinha (assim `http://localhost:3000` bate no app certo). */
const PORT = Number(process.env.PORT || 3000);

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(cookieParser());

registerEmailRoutes(app, { supabase, supabaseAnon });

app.get("/__health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "ttickett-server",
    timestamp: new Date().toISOString(),
  });
});

/** Porta fixa (`.env` / 3000); use a mesma na URL. */
app.get("/__meta", (_req: Request, res: Response) => {
  const p = PORT;
  res.status(200).json({
    port: p,
    urls: [`http://127.0.0.1:${p}`, `http://localhost:${p}`],
  });
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: payload?.msg || payload?.error_description || "Invalid login credentials",
      });
    }

    return res.json(payload);
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return res.status(504).json({ error: "LOGIN_TIMEOUT" });
    }
    return res.status(500).json({ error: error?.message || "NETWORK_ERROR" });
  } finally {
    clearTimeout(timeoutId);
  }
});

app.post("/api/admin/delete-user", async (req: Request, res: Response) => {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const targetUserId = String(req.body?.userId || "").trim();

  if (!token) return res.status(401).json({ error: "Token ausente." });
  if (!targetUserId) return res.status(400).json({ error: "userId é obrigatório." });
  if (!supabaseUrl || !anonKey) return res.status(500).json({ error: "Supabase não configurado no backend." });

  const usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!usingServiceRole) {
    return res.status(500).json({
      error:
        "SUPABASE_SERVICE_ROLE_KEY não configurada no backend. Não é possível excluir usuário do Auth do Supabase.",
    });
  }

  try {
    const { data: authData, error: authErr } = await supabaseAnon.auth.getUser(token);
    if (authErr || !authData?.user?.id) {
      return res.status(401).json({ error: "Token inválido." });
    }

    const requesterId = authData.user.id;
    const { data: requesterRow, error: reqDbErr } = await supabase
      .from("users")
      .select('id,role,"companyId"')
      .eq("id", requesterId)
      .maybeSingle();

    if (reqDbErr || !requesterRow) {
      return res.status(403).json({ error: "Sem permissão (perfil não encontrado)." });
    }

    const requesterRole = String((requesterRow as any).role || "");
    const requesterCompanyId = (requesterRow as any).companyId as string | null | undefined;

    const isTtickettAdmin = requesterRole === "ttickett_admin";
    const isCompanyAdmin = requesterRole === "admin";

    if (!isTtickettAdmin && !isCompanyAdmin) {
      return res.status(403).json({ error: "Sem permissão para excluir usuários." });
    }

    if (isCompanyAdmin) {
      if (!requesterCompanyId) {
        return res.status(403).json({ error: "Administrador sem companyId configurado." });
      }

      const { data: targetRow, error: targetErr } = await supabase
        .from("users")
        .select('id,role,"companyId","organizationId"')
        .eq("id", targetUserId)
        .maybeSingle();

      if (targetErr || !targetRow) {
        return res.status(404).json({ error: "Usuário alvo não encontrado." });
      }

      const targetRole = String((targetRow as any).role || "");
      if (targetRole === "ttickett_admin") {
        return res.status(403).json({ error: "Não é permitido excluir Administrador TTICKETT." });
      }

      const targetCompanyId = (targetRow as any).companyId as string | null | undefined;
      const targetOrgId = (targetRow as any).organizationId as string | null | undefined;

      let sameCompany = targetCompanyId != null && targetCompanyId === requesterCompanyId;
      if (!sameCompany && targetOrgId) {
        const { data: orgRow } = await supabase
          .from("organizations")
          .select('id,"companyId"')
          .eq("id", targetOrgId)
          .maybeSingle();
        sameCompany = !!orgRow?.companyId && orgRow.companyId === requesterCompanyId;
      }

      if (!sameCompany) {
        return res.status(403).json({ error: "Você só pode excluir usuários da sua empresa." });
      }
    }

    // 1) Exclui do Auth
    const { error: authDeleteErr } = await supabase.auth.admin.deleteUser(targetUserId);
    if (authDeleteErr) {
      return res.status(500).json({ error: authDeleteErr.message || "Falha ao excluir no Auth." });
    }

    // 2) Limpa a linha do app (caso não exista cascade)
    const { error: dbDeleteErr } = await supabase.from("users").delete().eq("id", targetUserId);
    if (dbDeleteErr) {
      // não falhar a requisição inteira: o Auth já foi excluído
      return res.status(200).json({ ok: true, warning: dbDeleteErr.message });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[delete-user] error:", e?.message || e);
    return res.status(500).json({ error: e?.message || "Erro inesperado." });
  }
});

app.post("/api/admin/reconcile-auth-users", async (req: Request, res: Response) => {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) return res.status(401).json({ error: "Token ausente." });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no backend." });
  }

  try {
    const { data: authData, error: authErr } = await supabaseAnon.auth.getUser(token);
    if (authErr || !authData?.user?.id) return res.status(401).json({ error: "Token inválido." });

    const requesterId = authData.user.id;
    const { data: requesterRow, error: reqDbErr } = await supabase
      .from("users")
      .select("id,role")
      .eq("id", requesterId)
      .maybeSingle();
    if (reqDbErr || !requesterRow) return res.status(403).json({ error: "Sem permissão." });

    const requesterRole = String((requesterRow as any).role || "");
    if (requesterRole !== "ttickett_admin") {
      return res.status(403).json({ error: "Apenas Administrador TTICKETT pode sincronizar usuários." });
    }

    const deleted: Array<{ id: string; email: string | null }> = [];
    const kept: number[] = [];

    let page = 1;
    const perPage = 1000;

    // paginar auth users
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) return res.status(500).json({ error: error.message || "Falha ao listar usuários do Auth." });
      const authUsers = data?.users || [];
      if (!authUsers.length) break;

      const ids = authUsers.map((u) => u.id);
      const { data: existingRows, error: existErr } = await supabase
        .from("users")
        .select("id")
        .in("id", ids);
      if (existErr) return res.status(500).json({ error: existErr.message || "Falha ao checar tabela users." });

      const existing = new Set((existingRows || []).map((r: any) => r.id));
      const toDelete = authUsers.filter((u) => !existing.has(u.id));

      for (const u of toDelete) {
        const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
        if (!delErr) deleted.push({ id: u.id, email: u.email ?? null });
      }

      kept.push(authUsers.length - toDelete.length);
      if (authUsers.length < perPage) break;
      page += 1;
    }

    return res.status(200).json({ ok: true, deletedCount: deleted.length, deleted, pages: page });
  } catch (e: any) {
    console.error("[reconcile-auth-users] error:", e?.message || e);
    return res.status(500).json({ error: e?.message || "Erro inesperado." });
  }
});

// API Routes
app.post("/api/upload", upload.single("file"), async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado." });
  }

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const bucket = "tickets";

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        contentType: req.file.mimetype,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    // Clean up local file
    fs.unlinkSync(req.file.path);

    res.json({
      id: fileName,
      name: req.file.originalname,
      url: publicUrl,
      type: req.file.mimetype.startsWith("image/") ? "image" : "file",
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Erro ao fazer upload para o Supabase Storage." });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const autoOpenBrowser =
    process.env.AUTO_OPEN_BROWSER === "true" &&
    process.env.NODE_ENV !== "production";

  const openBrowser = (url: string) => {
    const command =
      process.platform === "win32"
        ? `start "" "${url}"`
        : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
    exec(command, (error) => {
      if (error) {
        console.warn("[Server] Não foi possível abrir o navegador automaticamente.");
      }
    });
  };

  // Sem host fixo: no Windows, "localhost" pode usar IPv6; o default do Node costuma aceitar melhor que só 0.0.0.0.
  // Para forçar escuta em todas as interfaces: LISTEN_HOST=0.0.0.0
  const listenHost = process.env.LISTEN_HOST;
  const onListening = () => {
    const primary = `http://127.0.0.1:${PORT}`;
    const alt = `http://localhost:${PORT}`;
    console.log(`\n[TTICKETT] Servidor OK na porta ${PORT}`);
    console.log(`   → ${alt}/  (ou ${primary}/)`);
    console.log(`   → Health: ${alt}/__health   Meta: ${alt}/__meta\n`);
    if (autoOpenBrowser) {
      openBrowser(alt);
    }
  };

  const srv = listenHost ? app.listen(PORT, listenHost, onListening) : app.listen(PORT, onListening);

  srv.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n[TTICKETT] Porta ${PORT} já está em uso.`);
      console.error("   Outro processo está usando essa porta (outro Node, Docker, etc.).");
      console.error("   Feche-o ou no PowerShell: Get-NetTCPConnection -LocalPort " + PORT + " | Select OwningProcess\n");
      process.exit(1);
    }
    throw err;
  });
}

startServer();
