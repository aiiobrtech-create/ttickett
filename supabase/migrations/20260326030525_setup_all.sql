-- Enable UUID and pgcrypto extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create the admin user in auth.users
-- Password: Ttickett191406*
DO $$
DECLARE
  new_user_id UUID := uuid_generate_v4();
BEGIN
  -- Only insert if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@ttickett.com') THEN
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
      confirmation_token, 
      email_change, 
      email_change_token_new, 
      recovery_token
    )
    VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@ttickett.com',
      crypt('Ttickett191406*', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Administrador"}',
      now(),
      now(),
      'authenticated',
      '',
      '',
      '',
      ''
    );

    -- 2. Insert into public.users
    INSERT INTO public.users (id, name, email, role, "createdAt")
    VALUES (new_user_id, 'Administrador', 'admin@ttickett.com', 'admin', now());
  END IF;
END $$;

-- 2. Set up Storage for 'tickets' bucket
-- Note: Bucket creation via SQL might require specific permissions or extensions
-- We'll try to insert into storage.buckets if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('tickets', 'tickets', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 3. Set up Storage Policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    -- Public Access
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access' AND tablename = 'objects' AND schemaname = 'storage') THEN
      CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'tickets');
    END IF;

    -- Authenticated users can upload
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload files' AND tablename = 'objects' AND schemaname = 'storage') THEN
      CREATE POLICY "Authenticated users can upload files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tickets' AND auth.role() = 'authenticated');
    END IF;

    -- Users can manage their own files
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own files' AND tablename = 'objects' AND schemaname = 'storage') THEN
      CREATE POLICY "Users can manage their own files" ON storage.objects FOR ALL USING (bucket_id = 'tickets' AND auth.uid() = owner);
    END IF;
  END IF;
END $$;

-- 4. Seed data (copied from seed.sql)
INSERT INTO platforms (id, name, url, env) VALUES
('1', 'Portal do Cliente', 'https://cliente.ttickett.com', 'Produção'),
('2', 'Sistema Interno', 'https://interno.ttickett.com', 'Homologação'),
('3', 'Plataforma Financeira', 'https://financeiro.ttickett.com', 'Produção'),
('4', 'Dashboard Web', 'https://dash.ttickett.com', 'Produção'),
('5', 'API Gateway', 'https://api.ttickett.com', 'Desenvolvimento')
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, "desc") VALUES
('1', 'Bug Crítico', 'Problemas que impedem o uso do sistema.'),
('2', 'Dúvida Técnica', 'Perguntas sobre funcionamento de APIs.'),
('3', 'Sugestão', 'Melhorias sugeridas pelos usuários.'),
('4', 'Acesso', 'Problemas relacionados a login e permissões.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, platforms, categories, address, phone, contactPerson, email) VALUES
('00000000-0000-0000-0000-000000000001'::uuid, 'Empresa Alpha', '["1", "3"]'::jsonb, '["1", "2"]'::jsonb, 'Av. Paulista, 1000', '(11) 99999-9999', 'João Silva', 'contato@alpha.com'),
('00000000-0000-0000-0000-000000000002'::uuid, 'Empresa Beta', '["2", "4", "5"]'::jsonb, '["3", "4"]'::jsonb, 'Rua das Flores, 500', '(21) 88888-8888', 'Maria Souza', 'contato@beta.com')
ON CONFLICT (id) DO NOTHING;
