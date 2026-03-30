-- E-mail de suporte por empresa + metadados de thread em tickets (integração inbound/outbound)

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS "supportEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "defaultOrganizationId" UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "emailFromName" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS companies_support_email_lower_key
  ON public.companies (lower(trim("supportEmail")))
  WHERE "supportEmail" IS NOT NULL AND btrim("supportEmail") <> '';

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS "emailRootMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "emailLastMessageId" TEXT;

COMMENT ON COLUMN public.companies."supportEmail" IS 'Caixa que recebe e-mails para abrir/atualizar tickets (escopo empresa).';
COMMENT ON COLUMN public.companies."defaultOrganizationId" IS 'Organização padrão para tickets criados por e-mail (deve pertencer à mesma empresa).';
COMMENT ON COLUMN public.tickets."source" IS 'app | email';
