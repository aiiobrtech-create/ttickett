-- Plataformas e categorias por empresa; RLS alinhado ao escopo da empresa.
-- Chave primária composta ("companyId", id) para reutilizar os mesmos ids textuais por empresa.

ALTER TABLE public.platforms
  ADD COLUMN IF NOT EXISTS "companyId" UUID REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS "companyId" UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Vincular registros existentes à empresa mais antiga (mesma lógica de backfill anterior).
WITH def AS (
  SELECT id FROM public.companies ORDER BY "createdAt" ASC LIMIT 1
)
UPDATE public.platforms p
SET "companyId" = (SELECT id FROM def)
WHERE p."companyId" IS NULL;

WITH def AS (
  SELECT id FROM public.companies ORDER BY "createdAt" ASC LIMIT 1
)
UPDATE public.categories c
SET "companyId" = (SELECT id FROM def)
WHERE c."companyId" IS NULL;

ALTER TABLE public.platforms ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE public.platforms DROP CONSTRAINT IF EXISTS platforms_pkey;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_pkey;

ALTER TABLE public.platforms ADD PRIMARY KEY ("companyId", id);
ALTER TABLE public.categories ADD PRIMARY KEY ("companyId", id);

-- Duplicar catálogos da empresa padrão para as demais empresas (mantém ids alinhados ao JSONB das organizações).
DO $$
DECLARE
  def_id uuid;
BEGIN
  SELECT id INTO def_id FROM public.companies ORDER BY "createdAt" ASC LIMIT 1;

  INSERT INTO public.platforms ("companyId", id, name, url, env, "createdAt")
  SELECT c.id, p.id, p.name, p.url, p.env, p."createdAt"
  FROM public.companies c
  CROSS JOIN public.platforms p
  WHERE p."companyId" = def_id
    AND c.id IS DISTINCT FROM def_id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.categories ("companyId", id, name, "desc", "createdAt")
  SELECT c.id, k.id, k.name, k."desc", k."createdAt"
  FROM public.companies c
  CROSS JOIN public.categories k
  WHERE k."companyId" = def_id
    AND c.id IS DISTINCT FROM def_id
  ON CONFLICT DO NOTHING;
END $$;

-- Leitura aberta por autenticação — substituída por escopo
DROP POLICY IF EXISTS "Platforms are viewable by authenticated users" ON public.platforms;
DROP POLICY IF EXISTS "Categories are viewable by authenticated users" ON public.categories;

-- Gestão exclusiva ttickett_admin — recorta em políticas separadas
DROP POLICY IF EXISTS "TTICKETT admins manage platforms" ON public.platforms;
DROP POLICY IF EXISTS "TTICKETT admins manage categories" ON public.categories;

CREATE POLICY "platforms_select_scoped" ON public.platforms
  FOR SELECT TO authenticated
  USING (
    public.is_ttickett_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'agent' AND u."companyId" IS NULL)
        OR (u."companyId" IS NOT NULL AND u."companyId" = platforms."companyId")
        OR EXISTS (
          SELECT 1
          FROM public.user_organizations uo
          JOIN public.organizations o ON o.id = uo."organizationId"
          WHERE uo."userId" = u.id
            AND o."companyId" IS NOT NULL
            AND o."companyId" = platforms."companyId"
        )
      )
    )
  );

CREATE POLICY "categories_select_scoped" ON public.categories
  FOR SELECT TO authenticated
  USING (
    public.is_ttickett_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'agent' AND u."companyId" IS NULL)
        OR (u."companyId" IS NOT NULL AND u."companyId" = categories."companyId")
        OR EXISTS (
          SELECT 1
          FROM public.user_organizations uo
          JOIN public.organizations o ON o.id = uo."organizationId"
          WHERE uo."userId" = u.id
            AND o."companyId" IS NOT NULL
            AND o."companyId" = categories."companyId"
        )
      )
    )
  );

CREATE POLICY "platforms_ttickett_admin_all" ON public.platforms
  FOR ALL
  USING (public.is_ttickett_admin())
  WITH CHECK (public.is_ttickett_admin());

CREATE POLICY "categories_ttickett_admin_all" ON public.categories
  FOR ALL
  USING (public.is_ttickett_admin())
  WITH CHECK (public.is_ttickett_admin());

CREATE POLICY "platforms_company_admin_insert" ON public.platforms
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_company_admin()
    AND NOT public.is_ttickett_admin()
    AND "companyId" IS NOT NULL
    AND "companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  );

CREATE POLICY "platforms_company_admin_update" ON public.platforms
  FOR UPDATE TO authenticated
  USING (
    public.is_company_admin()
    AND NOT public.is_ttickett_admin()
    AND "companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  )
  WITH CHECK (
    public.is_company_admin()
    AND NOT public.is_ttickett_admin()
    AND "companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  );

CREATE POLICY "platforms_company_admin_delete" ON public.platforms
  FOR DELETE TO authenticated
  USING (
    public.is_company_admin()
    AND NOT public.is_ttickett_admin()
    AND "companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  );

CREATE POLICY "categories_company_admin_insert" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_company_admin()
    AND NOT public.is_ttickett_admin()
    AND "companyId" IS NOT NULL
    AND "companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  );

CREATE POLICY "categories_company_admin_update" ON public.categories
  FOR UPDATE TO authenticated
  USING (
    public.is_company_admin()
    AND NOT public.is_ttickett_admin()
    AND "companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  )
  WITH CHECK (
    public.is_company_admin()
    AND NOT public.is_ttickett_admin()
    AND "companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  );

CREATE POLICY "categories_company_admin_delete" ON public.categories
  FOR DELETE TO authenticated
  USING (
    public.is_company_admin()
    AND NOT public.is_ttickett_admin()
    AND "companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  );

-- Organizações: exige mesma empresa do usuário; clientes só via vínculo em user_organizations (ou admin/agent da empresa).
DROP POLICY IF EXISTS "Organizations scoped select" ON public.organizations;
CREATE POLICY "Organizations scoped select" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    public.is_ttickett_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'agent' AND u."companyId" IS NULL)
        OR (
          u."companyId" IS NOT NULL
          AND organizations."companyId" IS NOT NULL
          AND organizations."companyId" = u."companyId"
          AND (
            public.is_company_admin()
            OR u.role = 'agent'
            OR EXISTS (
              SELECT 1 FROM public.user_organizations uo
              WHERE uo."userId" = u.id AND uo."organizationId" = organizations.id
            )
          )
        )
        OR (
          u."companyId" IS NULL
          AND EXISTS (
            SELECT 1 FROM public.user_organizations uo
            WHERE uo."userId" = u.id AND uo."organizationId" = organizations.id
          )
        )
      )
    )
  );
