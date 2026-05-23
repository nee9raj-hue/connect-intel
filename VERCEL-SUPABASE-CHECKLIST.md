# Vercel + Supabase — resolved checklist

## Root cause (May 2026)

1. **Hobby plan limit:** Vercel allows **12 serverless functions** max. The app had **18** files under `api/`, so every deploy **failed** and production stayed on an old build (`sqlite`, no Supabase).
2. **Fix:** One router at `api/index.js` + handlers in `lib/server/handlers/` (1 function total).
3. **Env vars** were already set on Vercel; they only took effect after a **successful** deploy.

## Verify production

- App: https://connectintel.net/
- Health: https://connectintel.net/api/health
- Status: https://connectintel.net/api/integrations/status

Success:

```json
"storage": "supabase",
"supabaseConnected": true
```

## Required Vercel env vars (Production)

| Key | Value |
|-----|--------|
| `SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` (no `/rest/v1/`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **Secret** key |
| `SESSION_SECRET` | Random string (auto-added via CLI) |
| `APP_URL` | `https://connectintel.net` |
| `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` | Google OAuth |
| `PERPLEXITY_API_KEY` | Optional AI discovery |

## Settings

- **Root Directory:** empty (`.`) — not `frontend`
- **Production branch:** `main`

## Deploy from your Mac (if Git deploy fails)

```bash
cd "/Users/apple/Downloads/Connect intel"
vercel pull --yes --environment=production
vercel build --prod --yes
vercel deploy --prebuilt --prod --yes
```

## Supabase SQL

Run `supabase/schema.sql` once in SQL Editor → "Success. No rows returned" is correct.
