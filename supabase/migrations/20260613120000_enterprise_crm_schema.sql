-- Connect Intel — Enterprise CRM schema (organizations, profiles, encrypted leads)
--
-- Goals: indexed relational rows (6k+ leads fast), tenant isolation (RLS), PII encryption (Vault).
-- Zero-downtime: runs alongside store_collections + pipeline_leads; backfill via scripts/backfill-enterprise-crm.mjs
--
-- ONE-TIME after migration (Supabase SQL editor — replace with a strong random secret):
--   SELECT vault.create_secret('<32+ char random secret>', 'connect_intel_lead_pii', 'Lead PII encryption key');
--
-- Prereqs: auth.users optional until Auth cutover; Vercel uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).

-- ─── Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- ─── 1. Organizations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  company_name TEXT NOT NULL,
  domain TEXT,
  account_type TEXT NOT NULL DEFAULT 'company' CHECK (account_type IN ('company', 'individual')),
  owner_legacy_user_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_organizations_legacy_id ON public.organizations (legacy_id);
CREATE INDEX IF NOT EXISTS idx_organizations_company_name ON public.organizations (company_name);

-- ─── 2. Profiles (app employees; links to Supabase Auth when ready) ───────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL,
  legacy_user_id TEXT UNIQUE,
  organization_id UUID REFERENCES public.organizations (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'rep' CHECK (role IN ('admin', 'manager', 'rep')),
  pipeline_role TEXT,
  can_search BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_legacy_user_id ON public.profiles (legacy_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));

-- ─── PII seal/open (Vault-backed; service_role only) ──────────────────────
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

CREATE OR REPLACE FUNCTION public.seal_lead_pii(plaintext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_material TEXT;
BEGIN
  IF plaintext IS NULL OR btrim(plaintext) = '' THEN
    RETURN NULL;
  END IF;

  key_material := public._lead_pii_key();
  IF key_material IS NULL OR btrim(key_material) = '' THEN
    RAISE EXCEPTION 'Vault secret connect_intel_lead_pii missing — run vault.create_secret first';
  END IF;

  RETURN encode(pgp_sym_encrypt(plaintext, key_material, 'cipher-algo=aes256'), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.open_lead_pii(sealed TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  RETURN pgp_sym_decrypt(decode(sealed, 'base64'), key_material, 'cipher-algo=aes256');
END;
$$;

REVOKE ALL ON FUNCTION public._lead_pii_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seal_lead_pii(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_lead_pii(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._lead_pii_key() TO service_role;
GRANT EXECUTE ON FUNCTION public.seal_lead_pii(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.open_lead_pii(TEXT) TO service_role;

-- ─── 3. Enterprise leads (one row per pipeline contact) ───────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_lead_id TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles (id) ON DELETE SET NULL,

  lead_status TEXT NOT NULL DEFAULT 'new' CHECK (
    lead_status IN (
      'new', 'contacted', 'follow_up', 'replied', 'won', 'active_trading', 'lost'
    )
  ),
  lead_source TEXT,
  lead_score INT,
  company_name TEXT,
  city TEXT,
  state TEXT,
  country TEXT,

  email_hash TEXT,
  phone_hash TEXT,

  encrypted_first_name TEXT,
  encrypted_last_name TEXT,
  encrypted_email TEXT,
  encrypted_phone TEXT,

  crm_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  saved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT leads_org_legacy_unique UNIQUE (organization_id, legacy_lead_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON public.leads (organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON public.leads (organization_id, lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_org_updated ON public.leads (organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_org_saved ON public.leads (organization_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email_hash ON public.leads (organization_id, email_hash)
  WHERE email_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_phone_hash ON public.leads (organization_id, phone_hash)
  WHERE phone_hash IS NOT NULL;

-- ─── Row Level Security ───────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select_member ON public.organizations
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT p.organization_id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
  );

CREATE POLICY profiles_select_self_or_org ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR organization_id IN (
      SELECT p.organization_id FROM public.profiles p WHERE p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY leads_select_tenant ON public.leads
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id FROM public.profiles p WHERE p.auth_user_id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.auth_user_id = auth.uid()
          AND p.organization_id = leads.organization_id
          AND p.role IN ('admin', 'manager')
      )
      OR assigned_to IN (SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
    )
  );

CREATE POLICY leads_insert_admin ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_user_id = auth.uid()
        AND p.organization_id = leads.organization_id
        AND p.role IN ('admin', 'manager')
    )
  );

CREATE POLICY leads_update_tenant ON public.leads
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id FROM public.profiles p WHERE p.auth_user_id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.auth_user_id = auth.uid()
          AND p.organization_id = leads.organization_id
          AND p.role IN ('admin', 'manager')
      )
      OR assigned_to IN (SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid())
    )
  );

COMMENT ON TABLE public.organizations IS 'Tenant workspace — one row per company.';
COMMENT ON TABLE public.profiles IS 'App users; auth_user_id links Supabase Auth when enabled.';
COMMENT ON TABLE public.leads IS 'Enterprise pipeline lead — Vault-encrypted PII, indexed status/assignee.';
COMMENT ON COLUMN public.leads.legacy_lead_id IS 'Maps to entry.lead.id / contact id in current JSON store.';
COMMENT ON COLUMN public.leads.email_hash IS 'SHA-256(normalized email) for dedupe/search without decrypt.';
