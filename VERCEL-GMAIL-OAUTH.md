# Fix: “Gmail connect is not configured on the server”

Google **sign-in** only needs the public Client ID (`VITE_GOOGLE_CLIENT_ID`).

**Connect work Gmail** also needs the **Client secret** on the **server** (Vercel). Without it, every customer sees the amber “not configured” message.

---

## 1. Google Cloud (same project as login)

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Open your **OAuth 2.0 Client ID** (type **Web application**).
3. Under **Authorized redirect URIs**, add **both** if missing:

   ```
   https://connectintel.net/api/team/email-oauth/callback
   ```

   For local dev:

   ```
   http://localhost:5173/api/team/email-oauth/callback
   ```

4. **Save**.
5. On that same client, copy:
   - **Client ID** → `…apps.googleusercontent.com`
   - **Client secret** → `GOCSPX-…`

---

## 2. Vercel environment variables

1. [Vercel](https://vercel.com) → project **connect-intel** → **Settings** → **Environment Variables**
2. Add or update for **Production** (and Preview if you test previews):

| Name | Value |
|------|--------|
| `VITE_GOOGLE_CLIENT_ID` | Same Client ID (frontend sign-in) |
| `GOOGLE_CLIENT_ID` | **Same** Client ID |
| `GOOGLE_CLIENT_SECRET` | Client secret from step 1 |
| `APP_URL` | `https://connectintel.net` |

3. **Save** each variable.

**Common mistake:** Only `VITE_GOOGLE_CLIENT_ID` is set. Gmail connect **requires** `GOOGLE_CLIENT_SECRET` (no `VITE_` prefix — server only).

---

## 3. Redeploy (required)

Env vars apply only after a new deployment:

```bash
vercel --prod
```

Or Vercel → **Deployments** → **Redeploy** latest production.

Wait until status is **Ready** (~1 minute).

---

## 4. Verify

1. Sign in to https://connectintel.net as platform admin.
2. **Team** → **CRM email** → should show **Connect work Gmail** (not the amber “not configured” box).
3. Or open (while logged in) browser devtools → Network → `GET /api/crm/email-gmail-status` → JSON should include `"configured": true`.

---

## 5. Then connect Gmail (test users / verification)

After `configured: true`, reps still may see **“Google hasn’t verified this app”** until:

- Their email is on **Test users** in Google Cloud **Audience**, or  
- You complete **OAuth verification** for `gmail.send`.

See [GOOGLE-CRM-GMAIL-ACCESS.md](./GOOGLE-CRM-GMAIL-ACCESS.md).

---

## Checklist

- [ ] Redirect URI `https://connectintel.net/api/team/email-oauth/callback` in Google Cloud  
- [ ] `GOOGLE_CLIENT_SECRET` on Vercel Production  
- [ ] `GOOGLE_CLIENT_ID` matches `VITE_GOOGLE_CLIENT_ID`  
- [ ] `APP_URL=https://connectintel.net`  
- [ ] Production redeploy completed  
- [ ] `/api/crm/email-gmail-status` returns `"configured": true`
