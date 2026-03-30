-- Empresas: remove agente global vendo todas as linhas de companies (mesmo problema que organizations).
-- Cliente multi-org sem users.companyId passa a ver empresa via user_organizations → organizations.

DROP POLICY IF EXISTS "Companies select scoped" ON public.companies;
CREATE POLICY "Companies select scoped" ON public.companies
  FOR SELECT TO authenticated
  USING (
    public.is_ttickett_admin()
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
        OR EXISTS (
          SELECT 1 FROM public.user_organizations uo
          JOIN public.organizations o ON o.id = uo."organizationId"
          WHERE uo."userId" = u.id
            AND o."companyId" = companies.id
        )
      )
    )
  );
