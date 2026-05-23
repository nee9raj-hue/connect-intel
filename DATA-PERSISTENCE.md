# Data persistence (why logout must not wipe your CRM)

## Production requirement

On **Vercel**, all CRM data (pipeline, saved leads, Gmail tokens, team) must live in **Supabase** (`store_collections` table).

Required env vars on **Production**:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## What went wrong (fixed)

Previously, if Supabase was slow or failed for one request, the server could fall back to an **empty temporary SQLite file** in `/tmp`. The next save could **overwrite Supabase** with that empty snapshot — pipeline and Gmail connect looked “vanished” after re-login.

**Fix:** On Vercel we no longer fall back to ephemeral SQLite. Reads retry Supabase; writes refuse to save if they would wipe most of your data.

## After deploy

1. Sign out and sign in again (session reloads from Supabase).
2. Reconnect **work Gmail** once if needed (token is stored on your user in Supabase).
3. Re-import or re-save leads only if they are still missing (data lost before this fix cannot be auto-restored unless you have a Supabase backup).

Verify: `GET https://connectintel.net/api/integrations/status` → `"storage":"supabase"`, `"supabaseConnected":true`.
