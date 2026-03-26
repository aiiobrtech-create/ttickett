-- Simplify users table policies to avoid any potential issues
-- 1. Drop existing policies on users
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- 2. Create direct policies without function calls for basic access
-- This allows a user to read their own record directly
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- This allows a user to update their own record directly
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- 3. Use the is_admin() function only for admin-specific policies
-- This function is already SECURITY DEFINER, so it should be safe
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can manage all users" ON users
  FOR ALL USING (is_admin());

-- 4. Ensure the users table has RLS enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
