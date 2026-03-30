-- Corrige vazamento multi-empresa: atendentes com companyId nulo viam TODAS as organizações
-- (e catálogos), ignorando organizations.companyId. Remove essa exceção.
-- Mantém cliente legado: users.organizationId + mesma empresa quando houver companyId.

DROP POLICY IF EXISTS "Organizations scoped select" ON public.organizations;
CREATE POLICY "Organizations scoped select" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    public.is_ttickett_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        (
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
            OR (
              u.role = 'client'
              AND u."organizationId" IS NOT NULL
              AND u."organizationId" = organizations.id
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
        OR (
          u."organizationId" IS NOT NULL
          AND u."organizationId" = organizations.id
          AND (
            u."companyId" IS NULL
            OR organizations."companyId" IS NULL
            OR organizations."companyId" = u."companyId"
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "platforms_select_scoped" ON public.platforms;
CREATE POLICY "platforms_select_scoped" ON public.platforms
  FOR SELECT TO authenticated
  USING (
    public.is_ttickett_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        (u."companyId" IS NOT NULL AND u."companyId" = platforms."companyId")
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

DROP POLICY IF EXISTS "categories_select_scoped" ON public.categories;
CREATE POLICY "categories_select_scoped" ON public.categories
  FOR SELECT TO authenticated
  USING (
    public.is_ttickett_admin()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        (u."companyId" IS NOT NULL AND u."companyId" = categories."companyId")
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
