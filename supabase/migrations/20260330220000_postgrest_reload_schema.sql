-- Recalcula o cache de schema do PostgREST (evita erro "Could not find the 'companyId' column ...
-- in the schema cache" após ALTER em platforms/categories).
-- Pré-requisito: migração 20260330150000 (companyId + PK composta) já aplicada no banco.
NOTIFY pgrst, 'reload schema';
