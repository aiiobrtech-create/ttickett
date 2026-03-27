-- Papéis: ttickett_admin (acesso total) vs admin (cadastros apenas da própria empresa)

CREATE OR REPLACE FUNCTION public.is_ttickett_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'ttickett_admin'
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'ttickett_admin'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.company_admin_covers_membership(p_company_id uuid, p_org_id uuid)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_company uuid;
  me_role text;
BEGIN
  SELECT u."companyId", u.role INTO me_company, me_role
  FROM public.users u
  WHERE u.id = auth.uid();

  IF me_role IS DISTINCT FROM 'admin' OR me_company IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_company_id IS NOT NULL AND p_company_id = me_company THEN
    RETURN TRUE;
  END IF;

  IF p_org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o."companyId" = me_company
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Compat: qualquer administrador (para funções legadas)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.is_ttickett_admin() OR public.is_company_admin();
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_ttickett_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ttickett_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.company_admin_covers_membership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_admin_covers_membership(uuid, uuid) TO anon;

-- ========== companies ==========
DROP POLICY IF EXISTS "Companies manageable by admins" ON public.companies;
DROP POLICY IF EXISTS "TTICKETT admins insert companies" ON public.companies;
DROP POLICY IF EXISTS "TTICKETT admins update companies" ON public.companies;
DROP POLICY IF EXISTS "TTICKETT admins delete companies" ON public.companies;
DROP POLICY IF EXISTS "Company admins update own company" ON public.companies;

CREATE POLICY "TTICKETT admins insert companies" ON public.companies
  FOR INSERT WITH CHECK (public.is_ttickett_admin());

CREATE POLICY "TTICKETT admins update companies" ON public.companies
  FOR UPDATE USING (public.is_ttickett_admin())
  WITH CHECK (public.is_ttickett_admin());

CREATE POLICY "TTICKETT admins delete companies" ON public.companies
  FOR DELETE USING (public.is_ttickett_admin());

CREATE POLICY "Company admins update own company" ON public.companies
  FOR UPDATE USING (
    public.is_company_admin()
    AND id = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  )
  WITH CHECK (
    public.is_company_admin()
    AND id = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  );

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
        OR (u.role = 'agent' AND u."organizationId" IS NULL AND u."companyId" IS NULL)
      )
    )
  );

-- ========== organizations: gestão ==========
DROP POLICY IF EXISTS "Organizations are manageable by admins" ON public.organizations;

DROP POLICY IF EXISTS "TTICKETT admins manage all organizations" ON public.organizations;
CREATE POLICY "TTICKETT admins manage all organizations" ON public.organizations
  FOR ALL USING (public.is_ttickett_admin())
  WITH CHECK (public.is_ttickett_admin());

DROP POLICY IF EXISTS "Company admins insert organizations" ON public.organizations;
CREATE POLICY "Company admins insert organizations" ON public.organizations
  FOR INSERT WITH CHECK (
    public.is_company_admin()
    AND "companyId" IS NOT NULL
    AND "companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  );

DROP POLICY IF EXISTS "Company admins update organizations" ON public.organizations;
CREATE POLICY "Company admins update organizations" ON public.organizations
  FOR UPDATE USING (
    public.is_company_admin()
    AND "companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  )
  WITH CHECK (
    public.is_company_admin()
    AND "companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  );

DROP POLICY IF EXISTS "Company admins delete organizations" ON public.organizations;
CREATE POLICY "Company admins delete organizations" ON public.organizations
  FOR DELETE USING (
    public.is_company_admin()
    AND "companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  );

DROP POLICY IF EXISTS "Organizations scoped select" ON public.organizations;
CREATE POLICY "Organizations scoped select" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    public.is_ttickett_admin()
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

-- ========== platforms / categories ==========
DROP POLICY IF EXISTS "Platforms are manageable by admins" ON public.platforms;
DROP POLICY IF EXISTS "TTICKETT admins manage platforms" ON public.platforms;
CREATE POLICY "TTICKETT admins manage platforms" ON public.platforms
  FOR ALL USING (public.is_ttickett_admin())
  WITH CHECK (public.is_ttickett_admin());

DROP POLICY IF EXISTS "Categories are manageable by admins" ON public.categories;
DROP POLICY IF EXISTS "TTICKETT admins manage categories" ON public.categories;
CREATE POLICY "TTICKETT admins manage categories" ON public.categories
  FOR ALL USING (public.is_ttickett_admin())
  WITH CHECK (public.is_ttickett_admin());

-- ========== users ==========
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;

DROP POLICY IF EXISTS "TTICKETT admins full users" ON public.users;
CREATE POLICY "TTICKETT admins full users" ON public.users
  FOR ALL USING (public.is_ttickett_admin())
  WITH CHECK (public.is_ttickett_admin());

DROP POLICY IF EXISTS "Company admins scoped users select" ON public.users;
CREATE POLICY "Company admins scoped users select" ON public.users
  FOR SELECT USING (
    public.is_company_admin()
    AND public.company_admin_covers_membership(users."companyId", users."organizationId")
  );

DROP POLICY IF EXISTS "Company admins scoped users insert" ON public.users;
CREATE POLICY "Company admins scoped users insert" ON public.users
  FOR INSERT WITH CHECK (
    public.is_company_admin()
    AND public.company_admin_covers_membership(users."companyId", users."organizationId")
  );

DROP POLICY IF EXISTS "Company admins scoped users update" ON public.users;
CREATE POLICY "Company admins scoped users update" ON public.users
  FOR UPDATE USING (
    public.is_company_admin()
    AND public.company_admin_covers_membership(users."companyId", users."organizationId")
  )
  WITH CHECK (
    public.is_company_admin()
    AND public.company_admin_covers_membership(users."companyId", users."organizationId")
  );

DROP POLICY IF EXISTS "Company admins scoped users delete" ON public.users;
CREATE POLICY "Company admins scoped users delete" ON public.users
  FOR DELETE USING (
    public.is_company_admin()
    AND public.company_admin_covers_membership(users."companyId", users."organizationId")
  );

-- ========== tickets (admin global vs empresa) ==========
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.tickets;

DROP POLICY IF EXISTS "TTICKETT admins manage all tickets" ON public.tickets;
CREATE POLICY "TTICKETT admins manage all tickets" ON public.tickets
  FOR ALL USING (public.is_ttickett_admin())
  WITH CHECK (public.is_ttickett_admin());

DROP POLICY IF EXISTS "Company admins manage tickets in company" ON public.tickets;
CREATE POLICY "Company admins manage tickets in company" ON public.tickets
  FOR ALL USING (
    public.is_company_admin()
    AND tickets."companyId" IS NOT NULL
    AND tickets."companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  )
  WITH CHECK (
    public.is_company_admin()
    AND tickets."companyId" IS NOT NULL
    AND tickets."companyId" = (SELECT u."companyId" FROM public.users u WHERE u.id = auth.uid() AND u."companyId" IS NOT NULL)
  );
