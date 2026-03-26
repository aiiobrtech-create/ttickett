-- Reset Admin Password and Ensure Confirmation
-- Password: Ttickett191406*
DO $$
DECLARE
  admin_id UUID;
BEGIN
  -- 1. Check if admin exists in auth.users
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@ttickett.com';

  IF admin_id IS NOT NULL THEN
    -- Update existing user
    UPDATE auth.users
    SET 
      encrypted_password = crypt('Ttickett191406*', gen_salt('bf')),
      email_confirmed_at = now(),
      last_sign_in_at = NULL,
      raw_app_meta_data = '{"provider":"email","providers":["email"]}',
      raw_user_meta_data = '{"name":"Administrador"}',
      aud = 'authenticated',
      role = 'authenticated',
      updated_at = now()
    WHERE id = admin_id;
  ELSE
    -- Create new user
    admin_id := uuid_generate_v4();
    INSERT INTO auth.users (
      id, 
      instance_id, 
      email, 
      encrypted_password, 
      email_confirmed_at, 
      raw_app_meta_data, 
      raw_user_meta_data, 
      created_at, 
      updated_at, 
      role, 
      aud,
      confirmation_token, 
      email_change, 
      email_change_token_new, 
      recovery_token
    )
    VALUES (
      admin_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@ttickett.com',
      crypt('Ttickett191406*', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Administrador"}',
      now(),
      now(),
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    );
  END IF;

  -- 2. Ensure public.users entry exists
  INSERT INTO public.users (id, name, email, role, "createdAt")
  VALUES (admin_id, 'Administrador', 'admin@ttickett.com', 'admin', now())
  ON CONFLICT (id) DO UPDATE SET role = 'admin', email = 'admin@ttickett.com';
END $$;
