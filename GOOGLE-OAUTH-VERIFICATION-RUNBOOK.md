# Google OAuth verification runbook (Gmail-first product)

**Goal:** Any customer signs up at [connectintel.net](https://connectintel.net), signs in with Google, connects **work Gmail** once, and sends CRM / marketing email — **no per-customer DNS**.

**Owner:** Connect Intel platform (Google Cloud project + Vercel env).  
**Code paths:** `lib/server/gmailOAuth.js`, `lib/server/handlers/crm-email-oauth-start.js`, `lib/server/crmUserGmail.js`, `frontend/src/components/onboarding/GmailSetupModal.jsx`.

---

## Phase A — Prepare Google Cloud (1–2 hours)

### 1. OAuth client (same as login)

[Credentials](https://console.cloud.google.com/apis/credentials) → Web client:

| Redirect URI (required) |
|-------------------------|
| `https://connectintel.net/api/team/email-oauth/callback` |

Enable **Gmail API** for the project.

### 2. Consent screen — External

[Audience](https://console.cloud.google.com/auth/audience):

- User type: **External**
- Publishing status: stay **Testing** until submission; move to **In production** when submitting

[Branding](https://console.cloud.google.com/auth/branding):

| Field | Value |
|--------|--------|
| App name | Connect Intel |
| Support email | invite@connectintel.net |
| Home page | https://connectintel.net |
| Privacy policy | https://connectintel.net/privacy.html |
| Terms | https://connectintel.net/terms.html |
| Authorized domains | `connectintel.net` |

[Data access → Scopes](https://console.cloud.google.com/auth/scopes):

| Scope | User-facing purpose |
|--------|---------------------|
| `gmail.send` | Send emails the user composes in CRM/Marketing from their mailbox |
| `gmail.readonly` | Sync replies for leads already in their pipeline (optional step) |
| `email`, `profile`, `openid` | Sign-in and account identity |

### 3. Domain verification

Link [Search Console](https://search.google.com/search-console) property `connectintel.net` to this Cloud project if Verification center requests it.

---

## Phase B — Vercel env (before & after approval)

| Variable | When | Value |
|----------|------|--------|
| `GOOGLE_CLIENT_ID` | Always | Web client ID |
| `GOOGLE_CLIENT_SECRET` | Always | Web client secret |
| `VITE_GOOGLE_CLIENT_ID` | Always | Same client ID |
| `APP_URL` | Always | `https://connectintel.net` |
| `GOOGLE_OAUTH_ALLOW_CONNECT` | **During review / private beta** | `true` |
| `GOOGLE_OAUTH_VERIFIED` | **After Google approves** | `true` |

**Do not** set `GOOGLE_OAUTH_VERIFIED=true` before Google approves sensitive scopes.

Logic: `lib/server/config.js` → `canOfferCustomerGmailConnect()`, `isGoogleOAuthVerifiedForCustomers()`.

Redeploy after every env change.

---

## Phase C — Private beta while waiting (optional)

While app is **Testing**:

1. [Audience → Test users](https://console.cloud.google.com/auth/audience) → add each pilot email (e.g. `rep@customer.com`), max 100.
2. Vercel: `GOOGLE_OAUTH_ALLOW_CONNECT=true`
3. Pilots use **Advanced → Go to Connect Intel** if Google shows unverified warning.

This does **not** scale to public signup; it unblocks pilots only.

---

## Phase D — Submit verification (Verification center)

Open [Verification center](https://console.cloud.google.com/auth/verification) → submit **sensitive/restricted** scopes.

### Scope justification (paste)

**gmail.send**

> Connect Intel is a B2B CRM. The signed-in user connects their own work Gmail once. We send only messages they compose in our UI (pipeline email, bulk email, marketing campaigns) from their mailbox. We do not send unsolicited mail or read unrelated inbox content.

**gmail.readonly**

> Optional: sync email threads between the user’s mailbox and CRM leads already in their pipeline (filtered by lead email address). Users can log replies manually without this scope.

### Privacy & terms

- https://connectintel.net/privacy.html (includes Google Limited Use)
- https://connectintel.net/terms.html

### Demo video (2–3 min, unlisted YouTube)

Follow script: [GOOGLE-OAUTH-DEMO-SCRIPT.md](./GOOGLE-OAUTH-DEMO-SCRIPT.md)

Show: sign up → connect work Gmail → send one email from Pipeline → start small marketing send.

---

## Phase E — After approval

1. Google confirms **verified** for requested scopes.
2. Vercel Production:
   - `GOOGLE_OAUTH_VERIFIED=true`
   - Remove `GOOGLE_OAUTH_ALLOW_CONNECT` (optional)
3. Redeploy production.
4. [Audience](https://console.cloud.google.com/auth/audience) → **Publish app** / Production.
5. Smoke test with a **new** Gmail account (not on test-user list): sign up → Work email → connect → send.

Check operator dashboard: **System status** → Google OAuth phase should show **verified**.

---

## Timeline (typical)

| Step | Duration |
|------|----------|
| Branding + legal URLs | 1 day |
| Video + submission | 1 day |
| Google review (gmail.send) | 1–4+ weeks |
| CASA / security assessment | Sometimes required; add weeks |

---

## Checklist

- [ ] Redirect URI on OAuth client
- [ ] Gmail API enabled
- [ ] Privacy + terms live
- [ ] Consent screen branding complete
- [ ] Verification center submission + video
- [ ] Google approval email received
- [ ] `GOOGLE_OAUTH_VERIFIED=true` + redeploy
- [ ] Public test: new user connects Gmail without “Access blocked”
