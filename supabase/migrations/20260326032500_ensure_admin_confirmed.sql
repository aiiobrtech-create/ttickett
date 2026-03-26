-- Ensure admin user is fully confirmed and active
UPDATE auth.users
SET 
  email_confirmed_at = now(),
  last_sign_in_at = now(),
  raw_app_meta_data = '{"provider":"email","providers":["email"]}',
  raw_user_meta_data = '{"role":"admin"}',
  is_super_admin = false,
  role = 'authenticated',
  aud = 'authenticated'
WHERE email = 'admin@ttickett.com';

-- Ensure public.users record exists and is correct
INSERT INTO public.users (id, name, email, role)
SELECT id, 'Administrador', email, 'admin'
FROM auth.users
WHERE email = 'admin@ttickett.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin', name = 'Administrador';
