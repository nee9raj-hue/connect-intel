# Vercel + Supabase checklist (if status still shows `sqlite`)

## Your JSON means two problems

```json
"supabase": false
```

→ Server does **not** see `SUPABASE_URL` or the secret key at **runtime**.

No `"apiVersion": "2026-05-21-supabase-diag"` in the response → Production is **not** running the latest code from GitHub.

---

## Step 1 — Vercel project settings

**Settings → General**

| Setting | Must be |
|---------|---------|
| **Root Directory** | Empty (`.`) — **NOT** `frontend` |
| **Production Branch** | `main` |

If Root Directory is `frontend`, API routes in `/api` may never update.

---

## Step 2 — Environment variables (exact names)

**Settings → Environment Variables**

| Key | Value |
|-----|--------|
| `SUPABASE_URL` | `https://hkdrannqcnszfukcqchj.supabase.co` (no `/rest/v1/`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **Secret** key (`eyJ...`) |

- Enable **Production** (and Preview if you use it).
- Do **not** put the secret in the browser-exposed `VITE_` variables.

Also add (optional):

| Key | Value |
|-----|--------|
| `APP_URL` | `https://connect-intel-mocha.vercel.app` |
| `NODE_OPTIONS` | `--disable-warning=DEP0040` |

Click **Save**, then **Redeploy** (required).

---

## Step 3 — Confirm latest deploy is Production

**Deployments** tab:

1. Top deployment should be commit `e67f5c5` or newer.
2. Status **Ready**.
3. Environment **Production**.
4. If an older deployment is Production, click the latest → **⋯** → **Promote to Production**.

Or: **⋯ → Redeploy** on the latest commit (uncheck “Use existing Build Cache” if shown).

---

## Step 4 — Test endpoints

After redeploy:

**Health (new):**  
https://connect-intel-mocha.vercel.app/api/health

Should include:

```json
"apiVersion": "2026-05-21-supabase-diag",
"supabase": { "configured": true, "connected": true }
```

**Status:**  
https://connect-intel-mocha.vercel.app/api/integrations/status

Should include `apiVersion`, `supabaseEnv`, `storage: "supabase"`.

---

## Step 5 — Git connected?

**Settings → Git** → Repository should be `nee9raj-hue/connect-intel`, branch `main`, auto-deploy **on**.

If Git is disconnected, pushes to GitHub will not update the live site.

---

## Still stuck?

Open `/api/health` and paste the full JSON in chat — it shows which env vars the server sees (without exposing secrets).
