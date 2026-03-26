-- 1. Make the user renan@reetech.com.br an admin
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'renan@reetech.com.br';
BEGIN
  -- Get the ID from auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NOT NULL THEN
    -- Insert into public.users if missing, otherwise update
    INSERT INTO public.users (id, name, email, role, "createdAt")
    VALUES (v_user_id, 'Renan Reetech', v_email, 'admin', now())
    ON CONFLICT (id) DO UPDATE SET role = 'admin';

    -- Update auth.users metadata to include role
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
    WHERE id = v_user_id;
  END IF;
END $$;

-- 2. Clear all demo data (except users)
-- First, remove references in users
UPDATE public.users SET "organizationId" = NULL;

-- Then delete from tables
DELETE FROM public.tickets;
DELETE FROM public.organizations;
DELETE FROM public.platforms;
DELETE FROM public.categories;

-- 3. Re-grant permissions just in case
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
