-- Temporarily allow all authenticated users to read all users to debug
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (auth.role() = 'authenticated');
