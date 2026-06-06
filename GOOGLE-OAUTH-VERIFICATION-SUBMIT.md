# Google OAuth verification (Gmail-first)

**Full step-by-step:** [GOOGLE-OAUTH-VERIFICATION-RUNBOOK.md](./GOOGLE-OAUTH-VERIFICATION-RUNBOOK.md)  
**Demo video script:** [GOOGLE-OAUTH-DEMO-SCRIPT.md](./GOOGLE-OAUTH-DEMO-SCRIPT.md)

**Product goal:** Customers sign up → connect **work Gmail** → send CRM/marketing email. **No customer DNS.**

After Google approves `gmail.send` / `gmail.readonly`:

1. Vercel Production → `GOOGLE_OAUTH_VERIFIED=true`
2. Redeploy
3. Remove `GOOGLE_OAUTH_ALLOW_CONNECT` if you used it for beta

---

## What to submit (invite@connectintel.net / Google Cloud)

Project: **Connect Intel** (same OAuth client as login)

### 1. OAuth consent screen (required)

[Google Auth Platform → Branding](https://console.cloud.google.com/auth/branding)

| Field | Value |
|--------|--------|
| App name | Connect Intel |
| User support email | invite@connectintel.net |
| App logo | Upload Connect Intel logo |
| Application home page | https://connectintel.net |
| Privacy policy | https://connectintel.net/privacy.html |
| Terms of service | https://connectintel.net/terms.html |
| Authorized domains | connectintel.net |

[Audience](https://console.cloud.google.com/auth/audience):

- User type: **External**
- Publishing status: move to **In production** when ready to submit

[Data access](https://console.cloud.google.com/auth/scopes) — declare:

- `https://www.googleapis.com/auth/gmail.send` — Send CRM emails from the signed-in user’s work mailbox
- `https://www.googleapis.com/auth/gmail.readonly` — Sync inbound replies into the CRM thread
- `openid`, `email`, `profile` — Sign-in (if listed)

### 2. Verification center

[Verification center](https://console.cloud.google.com/auth/verification)

Submit for **sensitive/restricted** scopes. Provide:

**Why you need gmail.send**

> Connect Intel is a B2B CRM. Sales reps connect their own work Gmail once so outbound emails to leads are sent from their real mailbox (e.g. sales@customer.com), not a shared noreply address. We do not read unrelated mail; we only send messages the user composes in our UI.

**Why you need gmail.readonly**

> To show HubSpot-style email threads, we read messages only between the rep’s mailbox and leads already in their pipeline (search query filtered by lead email). Reps can still log replies manually without this scope.

**Privacy**

> https://connectintel.net/privacy.html explains data use, retention, and deletion.

**Demo video (2–3 min, unlisted YouTube)**

Show:

1. Sign in at https://connectintel.net with Google
2. Team → company domain OR (after verified) Connect work Gmail
3. Pipeline → open lead → Email → compose → Send
4. Optional: Sync from Gmail on a thread

**Domain verification**

Verify `connectintel.net` in [Google Search Console](https://search.google.com/search-console) and link to the Cloud project if requested.

### 3. Timeline

| Stage | Typical time |
|--------|----------------|
| Branding + privacy review | Days |
| gmail.send / gmail.readonly review | 1–4+ weeks |
| CASA security assessment | Sometimes required for restricted scopes; plan extra weeks |

---

## While waiting (customer-facing today)

1. Company admin: **Team → Outbound CRM email → Company domain (DNS)**
2. Add DNS records at registrar → **Check verification**
3. All reps on that domain send from CRM — **no Google OAuth for reps**

---

## After approval

```bash
# Vercel Production env
GOOGLE_OAUTH_VERIFIED=true
```

Redeploy. Re-enable per-user Gmail in the product for customers who prefer it over DNS.

---

## Checklist

- [ ] Privacy policy live at https://connectintel.net/privacy.html
- [ ] OAuth consent branding complete
- [ ] Scopes justified in Verification center
- [ ] Demo video uploaded
- [ ] App published to Production in Audience
- [ ] Google approval received
- [ ] `GOOGLE_OAUTH_VERIFIED=true` on Vercel + redeploy
