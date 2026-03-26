-- 1. Ensure the current user exists in public.users and is an admin
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'renan.santos95neves@gmail.com';
BEGIN
  -- Get the ID from auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NOT NULL THEN
    -- Insert into public.users if missing, otherwise update
    INSERT INTO public.users (id, name, email, role, "createdAt")
    VALUES (v_user_id, 'Renan Santos', v_email, 'admin', now())
    ON CONFLICT (id) DO UPDATE SET role = 'admin';

    -- 2. Update auth.users metadata to include role
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
    WHERE id = v_user_id;
  END IF;
END $$;
