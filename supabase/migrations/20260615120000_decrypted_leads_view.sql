-- Connect Intel — decrypted_leads view (SECURITY INVOKER, Vault-backed PII)
-- RLS on public.leads applies; plaintext via open_lead_pii (reads vault internally).

CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'connect_intel_lead_pii'
  ) THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'connect_intel_lead_pii',
      'Symmetric key for leads.email/phone/first_name/last_name (pgcrypto AES-256)'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._lead_pii_key()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'connect_intel_lead_pii'
  ORDER BY created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.open_lead_pii(sealed TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  key_material TEXT;
BEGIN
  IF sealed IS NULL OR btrim(sealed) = '' THEN
    RETURN NULL;
  END IF;

  key_material := public._lead_pii_key();
  IF key_material IS NULL OR btrim(key_material) = '' THEN
    RAISE EXCEPTION 'Vault secret connect_intel_lead_pii missing';
  END IF;

  RETURN pgp_sym_decrypt(
    decode(sealed, 'base64'),
    key_material,
    'cipher-algo=aes256'
  );
END;
$$;

REVOKE ALL ON FUNCTION public._lead_pii_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_lead_pii(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._lead_pii_key() TO service_role;
GRANT EXECUTE ON FUNCTION public.open_lead_pii(TEXT) TO authenticated, service_role;

DROP VIEW IF EXISTS public.decrypted_leads;

CREATE VIEW public.decrypted_leads
WITH (security_invoker = true)
AS
SELECT
  l.id,
  l.legacy_lead_id,
  l.organization_id,
  l.assigned_to,
  l.lead_status,
  l.lead_source,
  l.lead_score,
  l.company_name,
  l.city,
  l.state,
  l.country,
  l.email_hash,
  l.phone_hash,
  public.open_lead_pii(l.encrypted_first_name) AS first_name,
  public.open_lead_pii(l.encrypted_last_name) AS last_name,
  public.open_lead_pii(l.encrypted_email) AS email,
  public.open_lead_pii(l.encrypted_phone) AS phone,
  l.crm_payload,
  l.saved_at,
  l.created_at,
  l.updated_at
FROM public.leads AS l;

COMMENT ON VIEW public.decrypted_leads IS
  'SECURITY INVOKER: RLS on public.leads applies. PII decrypted via Vault (open_lead_pii).';

REVOKE ALL ON public.decrypted_leads FROM PUBLIC;
GRANT SELECT ON public.decrypted_leads TO authenticated, service_role;

-- Smoke test (returns 0 rows if table empty; verifies view parses)
SELECT count(*)::int AS decrypted_leads_rows FROM public.decrypted_leads LIMIT 1;
