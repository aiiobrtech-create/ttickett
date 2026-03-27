-- Número de ticket único e sequencial (evita colisão em tickets_number_key)

CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq;

SELECT setval(
  'public.ticket_number_seq',
  GREATEST(
    1000,
    COALESCE(
      (
        SELECT MAX(SUBSTRING(number FROM 4)::integer)
        FROM public.tickets
        WHERE number ~ '^TK-[0-9]+$'
      ),
      1000
    )
  ),
  true
);

CREATE OR REPLACE FUNCTION public.next_ticket_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'TK-' || nextval('public.ticket_number_seq')::text;
$$;

REVOKE ALL ON FUNCTION public.next_ticket_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_ticket_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_ticket_number() TO service_role;
