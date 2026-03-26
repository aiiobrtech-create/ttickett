-- Fix infinite recursion in users table policies
-- 1. Drop problematic policies
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- 2. Create a security definer function to check if a user is an admin
-- This bypasses RLS because it's SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Re-create policies using the function
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can manage all users" ON users
  FOR ALL USING (is_admin());

-- 4. Update other tables to use the same function for consistency and performance
DROP POLICY IF EXISTS "Organizations are manageable by admins" ON organizations;
CREATE POLICY "Organizations are manageable by admins" ON organizations
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Platforms are manageable by admins" ON platforms;
CREATE POLICY "Platforms are manageable by admins" ON platforms
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Categories are manageable by admins" ON categories;
CREATE POLICY "Categories are manageable by admins" ON categories
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage all tickets" ON tickets;
CREATE POLICY "Admins can manage all tickets" ON tickets
  FOR ALL USING (is_admin());
