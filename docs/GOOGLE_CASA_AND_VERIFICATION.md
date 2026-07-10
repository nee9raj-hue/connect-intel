# Google OAuth verification & CASA Tier 2 (Connect Intel)

**Project:** connect-intel (ID `968000502951`)  
**Production:** https://connectintel.net  
**Support:** invite@connectintel.net

Google’s current requirement is a **CASA Tier 2 security assessment** (deadline in their email: **26 Aug 2026**, annual). You cannot skip this for **restricted** scopes such as `gmail.send` / `gmail.readonly`.

---

## What Google is asking for now

| Requirement | Action |
|-------------|--------|
| **CASA Tier 2 assessment** | Engage an authorized lab (Google suggests **TAC Security** at a negotiated rate). Allow **up to 6 weeks**. |
| **Reply to Google’s email** | After you **start** the CASA process (or complete it), reply to the same thread so review continues. |
| **Chrome extension (v1.0)** | Store package ready — `docs/CHROME_WEB_STORE.md`. Extension uses web app session only; Gmail OAuth remains server-side. |

**Important:** You do **not** need to wait until CASA is finished to reply the first time. Reply to confirm you have **engaged a CASA lab** and give the expected completion date.

---

## Step 1 — Reply to Google (copy, edit, send)

Send from **invite@connectintel.net** (or the address on the OAuth consent screen). Reply **in the same email thread**.

```
Subject: Re: OAuth verification — Connect Intel (Project 968000502951) — CASA Tier 2 in progress

Hello Google Third Party Data Safety Team,

Thank you for the update on our verification for Connect Intel (Project ID: connect-intel / 968000502951).

We acknowledge the requirement to complete a CASA Tier 2 security assessment by 26 August 2026.

We have [engaged / are engaging] [TAC Security / authorized CASA lab name] to perform the Tier 2 assessment and expect to submit the report by [DATE — allow 4–6 weeks from kickoff].

Our application details:
- App name: Connect Intel
- Homepage: https://connectintel.net
- Privacy policy: https://connectintel.net/privacy.html
- Terms: https://connectintel.net/terms.html
- OAuth redirect URI: https://connectintel.net/api/team/email-oauth/callback

Scopes in use (minimum necessary):
- gmail.send — send CRM/marketing email the user composes from their work mailbox
- gmail.readonly — optional sync of threads with CRM leads only
- calendar.events — optional calendar import and CRM meeting push
- openid, email, profile — Google Sign-In

We do not use Google user data for advertising or model training. Our privacy policy includes Google API Services Limited Use and AI disclosure.

We will upload the CASA Tier 2 report to the Verification Center as soon as it is available and reply again when complete.

Please let us know if you need an extension or additional materials.

Thank you,
[Your name]
Connect Intel
invite@connectintel.net
```

Replace bracketed text before sending.

---

## Step 2 — Start CASA Tier 2 (this week)

1. Open [CASA website](https://appdefensealliance.dev/) and review Tier 2 scope.
2. Contact **TAC Security** (Google’s preferred partner) or another [authorized lab](https://appdefensealliance.dev/casa-labs).
3. Provide the lab:
   - App URL: https://connectintel.net
   - Architecture: Vercel serverless + Supabase, OAuth via PKCE (`lib/server/gmailOAuth.js`)
   - Data: CRM leads, OAuth refresh tokens, Gmail send/read (filtered), optional Calendar
   - Security controls already in place:
     - PKCE on OAuth (`S256`)
     - Signed OAuth `state`
     - Cross-Account Protection (RISC): `POST /api/google/risc`
     - Incremental scope requests (send / read / calendar separately)
     - Session cookies, HTTPS only
4. Schedule kickoff; target report **before Aug 2026**.

**Cost:** Paid assessment (TAC often discounted for Google-referred Tier 2). Budget and timeline with the lab directly.

**Tier 3** is optional (deeper infra audit). Tier 2 is sufficient unless Google or the lab recommends otherwise.

---

## Step 3 — Verification Center checklist

Open [Verification Center](https://console.cloud.google.com/auth/verification) for project **connect-intel**.

### Already in repo / production

| Item | Status / URL |
|------|----------------|
| App homepage | https://connectintel.net |
| Privacy policy | https://connectintel.net/privacy.html (includes Gmail, Calendar, AI disclosure) |
| Terms | https://connectintel.net/terms.html |
| OAuth redirect | `https://connectintel.net/api/team/email-oauth/callback` |
| PKCE + incremental scopes | `lib/server/gmailOAuth.js` |
| RISC endpoint | `https://connectintel.net/api/google/risc` |
| Internal runbook | `GOOGLE-OAUTH-VERIFICATION-RUNBOOK.md` |
| Demo script | `GOOGLE-OAUTH-DEMO-SCRIPT.md` |

### You must confirm in Console

- [ ] **Domain verification** — `connectintel.net` verified in [Search Console](https://search.google.com/search-console) and linked to Cloud project
- [ ] **Branding** — logo, support email, app name “Connect Intel”
- [ ] **Scopes** — only: `gmail.send`, `gmail.readonly`, `calendar.events`, `openid`, `email`, `profile` (no extra scopes)
- [ ] **Demo video** — 2–3 min unlisted YouTube per `GOOGLE-OAUTH-DEMO-SCRIPT.md`
- [ ] **Scope justification** — paste text from `GOOGLE-OAUTH-VERIFICATION-RUNBOOK.md` Phase D
- [ ] **In-app testing** — add reviewer test account if Google requests credentials
- [ ] **AI/ML disclosure** — privacy policy states no training on Google API data (updated May/June 2026)

---

## Step 4 — While CASA is in progress (optional beta)

Customers outside the test-user list see **“Access blocked”** until verification + CASA complete.

For pilots only:

1. Google Cloud → **Audience** → add test user emails (max 100).
2. Vercel → `GOOGLE_OAUTH_ALLOW_CONNECT=true` (do **not** set `GOOGLE_OAUTH_VERIFIED=true` yet).
3. Vercel → `GMAIL_ONBOARDING_PROMPT_ENABLED=true` to show the post-onboarding Gmail connect modal and getting-started step (only when connect is offered).
4. Pilots use **Advanced → Go to Connect Intel (unsafe)** if warned.

Alternative without Gmail OAuth: **Team → Company domain (DNS)** via Resend for outbound email.

---

## Step 5 — After Google approves + CASA report accepted

1. Google email: verification **approved**.
2. Vercel Production:
   - `GOOGLE_OAUTH_VERIFIED=true`
   - `GMAIL_ONBOARDING_PROMPT_ENABLED=true` (enables onboarding modal for all verified users)
   - Remove `GOOGLE_OAUTH_ALLOW_CONNECT` (optional)
3. Redeploy: `npm run prod:ship` → push → `npm run prod:log`
4. Google Cloud → **Audience** → **Publish app** (Production, not Testing).
5. Smoke test with a **new** Google account (not on test-user list): sign up → connect work Gmail → send email.

---

## Scope justification (for Verification Center)

**gmail.send**

> Connect Intel is a B2B CRM. The signed-in user connects their own work Gmail once. We send only messages they compose in our UI (pipeline email, bulk email, marketing campaigns) from their mailbox. We do not send unsolicited mail or read unrelated inbox content.

**gmail.readonly**

> Optional: sync email threads between the user’s mailbox and CRM leads already in their pipeline (filtered by lead email address). Users can log replies manually without this scope.

**calendar.events**

> Optional: display the user’s Google Calendar in our CRM calendar view (read-only import) and create Google Calendar events when the user schedules CRM meetings. We do not access unrelated calendars or delete events.

**openid / email / profile**

> Google Sign-In to create and secure the user’s Connect Intel account.

---

## Timeline (realistic)

| Phase | Duration |
|-------|----------|
| Reply to Google + contact CASA lab | 1–3 days |
| CASA Tier 2 assessment | 4–6 weeks |
| Google accepts report + final approval | 1–2 weeks after report |
| Set `GOOGLE_OAUTH_VERIFIED=true` | Same day as approval |

**Do not** set `GOOGLE_OAUTH_VERIFIED=true` before Google confirms approval — the app will show connect buttons to all users while Google still blocks unverified apps.

---

## FAQ

**Is the deadline June 26 or August 26?**  
Google’s email states **26 August 2026** for CASA completion. Reply promptly to confirm you are starting CASA; you do not need the full report on first reply.

**Can code changes replace CASA?**  
No. CASA is an independent security audit by an authorized lab.

**Does Google Sign-In need CASA?**  
Basic sign-in (`openid`, `email`, `profile`) is sensitive but not restricted. **Gmail** scopes are restricted and trigger CASA.

**Who pays for CASA?**  
Your organization pays the authorized lab (TAC Security or other).

---

## Related docs

- `GOOGLE-OAUTH-VERIFICATION-RUNBOOK.md` — full OAuth setup
- `GOOGLE-OAUTH-DEMO-SCRIPT.md` — verification video
- `docs/GOOGLE_CLOUD_OAUTH_CHECKLIST.md` — Console technical checklist
- `VERCEL-GMAIL-OAUTH.md` — env vars on Vercel
