-- Usuário com múltiplas organizações (escopo). Se não tiver nenhuma, acesso global conforme papel.

CREATE TABLE IF NOT EXISTS public.user_organizations (
  "userId" UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  "organizationId" UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "organizationId")
);

ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- Leitura: o próprio usuário, admins, e admin de empresa (escopado) podem ver memberships.
DROP POLICY IF EXISTS "User org memberships readable" ON public.user_organizations;
CREATE POLICY "User org memberships readable" ON public.user_organizations
  FOR SELECT TO authenticated
  USING (
    auth.uid() = "userId"
    OR public.is_ttickett_admin()
    OR (
      public.is_company_admin()
      AND EXISTS (
        SELECT 1
        FROM public.users me
        JOIN public.organizations o ON o.id = user_organizations."organizationId"
        WHERE me.id = auth.uid()
          AND me."companyId" IS NOT NULL
          AND o."companyId" = me."companyId"
      )
    )
  );

-- Escrita: apenas ttickett_admin, ou admin de empresa quando a org é da sua empresa.
DROP POLICY IF EXISTS "User org memberships writable" ON public.user_organizations;
CREATE POLICY "User org memberships writable" ON public.user_organizations
  FOR ALL TO authenticated
  USING (
    public.is_ttickett_admin()
    OR (
      public.is_company_admin()
      AND EXISTS (
        SELECT 1
        FROM public.users me
        JOIN public.organizations o ON o.id = user_organizations."organizationId"
        WHERE me.id = auth.uid()
          AND me."companyId" IS NOT NULL
          AND o."companyId" = me."companyId"
      )
    )
  )
  WITH CHECK (
    public.is_ttickett_admin()
    OR (
      public.is_company_admin()
      AND EXISTS (
        SELECT 1
        FROM public.users me
        JOIN public.organizations o ON o.id = user_organizations."organizationId"
        WHERE me.id = auth.uid()
          AND me."companyId" IS NOT NULL
          AND o."companyId" = me."companyId"
      )
    )
  );

-- Backfill: se users.organizationId existir, cria membership correspondente
INSERT INTO public.user_organizations ("userId", "organizationId")
SELECT u.id, u."organizationId"
FROM public.users u
WHERE u."organizationId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Organizações: ajusta select para memberships múltiplas
DROP POLICY IF EXISTS "Organizations scoped select" ON public.organizations;
CREATE POLICY "Organizations scoped select" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    public.is_ttickett_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- membro direto (multi-org)
        EXISTS (
          SELECT 1 FROM public.user_organizations uo
          WHERE uo."userId" = u.id AND uo."organizationId" = organizations.id
        )
        -- escopo por empresa
        OR (u."companyId" IS NOT NULL AND organizations."companyId" = u."companyId")
        -- agente global
        OR (u.role = 'agent' AND u."companyId" IS NULL)
      )
    )
  );

-- Tickets: clientes podem ver por membership de organização (multi-org)
DROP POLICY IF EXISTS "Clients can view their own tickets" ON public.tickets;
CREATE POLICY "Clients can view their own tickets" ON public.tickets
  FOR SELECT
  USING (
    auth.uid() = "requesterUid"
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'client'
        AND EXISTS (
          SELECT 1 FROM public.user_organizations uo
          WHERE uo."userId" = u.id
            AND uo."organizationId" IS NOT NULL
            AND uo."organizationId" = tickets."organizationId"
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'client'
        -- sem membership explícita (global), mas com companyId (escopo empresa + próprio solicitante)
        AND NOT EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo."userId" = u.id)
        AND u."companyId" IS NOT NULL
        AND tickets."companyId" IS NOT NULL
        AND tickets."companyId" = u."companyId"
        AND (
          auth.uid() = tickets."requesterUid"
          OR lower(trim(u.email)) = lower(trim(tickets."requesterEmail"))
        )
    )
  );

