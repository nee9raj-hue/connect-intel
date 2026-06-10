-- Connect Intel — auto-encrypt plaintext PII on leads INSERT/UPDATE
--
-- Writers send plain text in encrypted_first_name / encrypted_last_name / encrypted_email / encrypted_phone.
-- BEFORE trigger seals via Vault (seal_lead_pii) and refreshes email_hash / phone_hash.
--
-- We do NOT add organizations.encryption_secret — one Vault key (connect_intel_lead_pii) is already live.

CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- True when value is already Vault-sealed (open_lead_pii succeeds).
CREATE OR REPLACE FUNCTION public._lead_pii_is_sealed(val TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
BEGIN
  IF val IS NULL OR btrim(val) = '' THEN
    RETURN true;
  END IF;

  BEGIN
    PERFORM public.open_lead_pii(val);
    RETURN true;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN false;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.encrypt_lead_data_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
BEGIN
  IF NEW.encrypted_first_name IS NOT NULL
     AND btrim(NEW.encrypted_first_name) <> ''
     AND NOT public._lead_pii_is_sealed(NEW.encrypted_first_name) THEN
    NEW.encrypted_first_name := public.seal_lead_pii(NEW.encrypted_first_name);
  END IF;

  IF NEW.encrypted_last_name IS NOT NULL
     AND btrim(NEW.encrypted_last_name) <> ''
     AND NOT public._lead_pii_is_sealed(NEW.encrypted_last_name) THEN
    NEW.encrypted_last_name := public.seal_lead_pii(NEW.encrypted_last_name);
  END IF;

  IF NEW.encrypted_email IS NOT NULL
     AND btrim(NEW.encrypted_email) <> ''
     AND NOT public._lead_pii_is_sealed(NEW.encrypted_email) THEN
    NEW.email_hash := encode(
      extensions.digest(lower(btrim(NEW.encrypted_email)), 'sha256'),
      'hex'
    );
    NEW.encrypted_email := public.seal_lead_pii(lower(btrim(NEW.encrypted_email)));
  END IF;

  IF NEW.encrypted_phone IS NOT NULL
     AND btrim(NEW.encrypted_phone) <> ''
     AND NOT public._lead_pii_is_sealed(NEW.encrypted_phone) THEN
    NEW.phone_hash := encode(
      extensions.digest(
        regexp_replace(NEW.encrypted_phone, '[^0-9]', '', 'g'),
        'sha256'
      ),
      'hex'
    );
    NEW.encrypted_phone := public.seal_lead_pii(NEW.encrypted_phone);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._lead_pii_is_sealed(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._lead_pii_is_sealed(TEXT) TO service_role;

DROP TRIGGER IF EXISTS trg_encrypt_lead ON public.leads;

CREATE TRIGGER trg_encrypt_lead
  BEFORE INSERT OR UPDATE OF
    encrypted_first_name,
    encrypted_last_name,
    encrypted_email,
    encrypted_phone
  ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_lead_data_trigger();

COMMENT ON FUNCTION public.encrypt_lead_data_trigger() IS
  'Seals plaintext PII columns on leads using Vault (connect_intel_lead_pii).';
