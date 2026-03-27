-- Empresas (detentoras do sistema) e escopo por empresa/organização

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  observations TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Organizações pertencem a uma empresa
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS "companyId" UUID REFERENCES public.companies(id) ON DELETE RESTRICT;

-- Usuário pode ser vinculado à empresa e/ou organização
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "companyId" UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Ticket: empresa denormalizada (preenchida a partir da organização ao criar/atualizar)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS "companyId" UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Backfill: empresa padrão e vínculos
DO $$
DECLARE
  def_company_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies LIMIT 1) THEN
    INSERT INTO public.companies (name, observations)
    VALUES ('Empresa padrão', 'Criada automaticamente na migração de multi-empresa');
  END IF;

  SELECT id INTO def_company_id FROM public.companies ORDER BY "createdAt" LIMIT 1;

  UPDATE public.organizations
  SET "companyId" = def_company_id
  WHERE "companyId" IS NULL;

  UPDATE public.tickets t
  SET "companyId" = o."companyId"
  FROM public.organizations o
  WHERE t."organizationId" = o.id AND t."companyId" IS NULL;
END $$;

-- RLS: empresas
DROP POLICY IF EXISTS "Companies manageable by admins" ON public.companies;
DROP POLICY IF EXISTS "Companies select scoped" ON public.companies;

CREATE POLICY "Companies manageable by admins" ON public.companies
  FOR ALL USING (public.is_admin());

CREATE POLICY "Companies select scoped" ON public.companies
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        (u."companyId" IS NOT NULL AND u."companyId" = companies.id)
        OR (
          u."organizationId" IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = u."organizationId" AND o."companyId" = companies.id
          )
        )
        OR (u.role = 'agent' AND u."organizationId" IS NULL AND u."companyId" IS NULL)
      )
    )
  );

-- RLS: organizações — substitui leitura aberta
DROP POLICY IF EXISTS "Organizations are viewable by authenticated users" ON public.organizations;
DROP POLICY IF EXISTS "Organizations scoped select" ON public.organizations;

CREATE POLICY "Organizations scoped select" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        (u."organizationId" IS NOT NULL AND u."organizationId" = organizations.id)
        OR (u."companyId" IS NOT NULL AND organizations."companyId" = u."companyId")
        OR (u.role = 'agent' AND u."organizationId" IS NULL AND u."companyId" IS NULL)
      )
    )
  );

-- Tickets: política de cliente (empresa + organização)
DROP POLICY IF EXISTS "Clients can view their own tickets" ON public.tickets;

CREATE POLICY "Clients can view their own tickets" ON public.tickets
  FOR SELECT
  USING (
    auth.uid() = "requesterUid"
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'client'
        AND u."organizationId" IS NOT NULL
        AND u."organizationId" = tickets."organizationId"
    )
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'client'
        AND u."organizationId" IS NULL
        AND u."companyId" IS NOT NULL
        AND tickets."companyId" IS NOT NULL
        AND tickets."companyId" = u."companyId"
        AND (
          auth.uid() = tickets."requesterUid"
          OR lower(trim(u.email)) = lower(trim(tickets."requesterEmail"))
        )
    )
  );

-- Tickets: agente com escopo empresa/organização
DROP POLICY IF EXISTS "Agents can view and update assigned tickets" ON public.tickets;

CREATE POLICY "Agents can view and update assigned tickets" ON public.tickets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'agent'
        AND u.name = tickets.assignee
        AND (
          (u."organizationId" IS NULL AND u."companyId" IS NULL)
          OR (u."organizationId" IS NOT NULL AND tickets."organizationId" = u."organizationId")
          OR (
            u."organizationId" IS NULL
            AND u."companyId" IS NOT NULL
            AND tickets."companyId" IS NOT NULL
            AND tickets."companyId" = u."companyId"
          )
        )
    )
  );
