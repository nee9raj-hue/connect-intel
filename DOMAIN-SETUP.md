# Use connectintel.net as your app URL

Production app: **https://connectintel.net**  
Old URL (redirects automatically): `https://connect-intel-mocha.vercel.app`

---

## Step 1 — Add domain in Vercel

1. Open [vercel.com](https://vercel.com) → project **connect-intel**
2. **Settings** → **Domains**
3. Add:
   - `connectintel.net`
   - `www.connectintel.net` (optional; redirects to apex)
4. Vercel shows **DNS records** to add — keep that tab open

---

## Step 2 — DNS at Squarespace (connectintel.net)

1. [domains.squarespace.com](https://domains.squarespace.com) → **connectintel.net** → **DNS**
2. Add what Vercel asks for. Usually:

| Host | Type | Value |
|------|------|--------|
| `@` | `A` | `76.76.21.21` |
| `www` | `CNAME` | `cname.vercel-dns.com` |

Use the **exact** values Vercel shows if they differ.

3. Wait 10–60 minutes for DNS to propagate
4. In Vercel, domain status should turn **Valid**

---

## Step 3 — Vercel environment variable

**Settings** → **Environment Variables** → **Production**:

| Name | Value |
|------|--------|
| `APP_URL` | `https://connectintel.net` |

**Redeploy** (Deployments → … → Redeploy).

---

## Step 4 — Google Cloud (OAuth)

Project **Connect Intel** → **Google Auth Platform** / **Clients** → your **Web client**:

**Authorized JavaScript origins** — add:

```text
https://connectintel.net
```

**Authorized redirect URIs** — add:

```text
https://connectintel.net/api/team/email-oauth/callback
```

**OAuth consent screen** → **App domain**:

- Application home page: `https://connectintel.net`
- Privacy policy: `https://connectintel.net/privacy`
- Authorized domains: `connectintel.net`

Add **JavaScript origins** (required for customer login — fixes `origin_mismatch`):

```text
https://connectintel.net
https://www.connectintel.net
```

Keep old `connect-intel-mocha.vercel.app` origins temporarily if people still use that link.

**Customers must use External + Published OAuth** — see [FIX-GOOGLE-401.md](./FIX-GOOGLE-401.md).

**Team invite email:** After domain change, open **System status** → **Connect invite@connectintel.net** once (Google may need consent again on the new URL).

---

## Step 5 — Test

| Check | URL |
|-------|-----|
| App loads | https://connectintel.net |
| Privacy | https://connectintel.net/privacy |
| API health | https://connectintel.net/api/health |
| Invite email status | https://connectintel.net/api/setup/resend-dns |
| Old URL redirects | https://connect-intel-mocha.vercel.app → connectintel.net |

Sign in with Google on the **new** domain.

---

## Email (Resend / SPF)

If you use Resend for `invite@connectintel.net`, DNS for email stays in Squarespace (DKIM/SPF). That is separate from the **website** A/CNAME records above.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Domain not verified on Vercel | Wait for DNS; confirm `@` A record points to Vercel |
| Google “redirect_uri_mismatch” | Redirect URI must be exactly `https://connectintel.net/api/team/email-oauth/callback` |
| Invite connect loop | Set `APP_URL`, redeploy, reconnect invite@ on System status |
| SSL certificate pending | Wait up to 24h after DNS is correct |
