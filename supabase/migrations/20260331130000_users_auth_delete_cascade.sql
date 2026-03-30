-- Excluir em auth.users passa a remover public.users em cascata (GoTrue deixa de falhar com FK).

DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'users'
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey_auth_cascade
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
