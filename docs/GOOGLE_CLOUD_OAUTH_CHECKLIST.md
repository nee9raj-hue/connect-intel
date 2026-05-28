# Google Cloud OAuth checklist (Connect Intel)

Use this after deploying OAuth hardening (PKCE, incremental scopes, RISC endpoint).

## In Google Cloud Console

### 1. OAuth client (Credentials → Web client)

- **Authorized redirect URI** (exact):
  - `https://connectintel.net/api/team/email-oauth/callback`
- Remove any `http://` redirect URIs for production.
- Do not use WebViews for sign-in (already satisfied).

### 2. OAuth consent screen → Scopes

Only list scopes you use:

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/userinfo.email`

### 3. Cross-Account Protection (RISC)

1. Open **Google Auth Platform** → **Cross-Account Protection** (or Security → Cross-Account Protection).
2. Register receiver URL:
   - `https://connectintel.net/api/google/risc`
3. Save. Google will send test events; our API returns `200` when valid.

This clears revoked Google sessions for users who connected work Gmail (uses stored `googleSub`).

### 4. Verification centre

- Keep app in **Production** / complete verification (privacy policy, demo video, scope justification).
- Do **not** switch back to Testing unless you accept invalidating all user tokens.

### 5. Billing (recommended)

- Link a billing account on the project (free tier still applies; reduces warnings).

### 6. Project contacts

- **IAM & Admin** → ensure at least one owner and a technical contact email.

## What we changed in code

| Console warning | Code change |
|-----------------|-------------|
| Use secure flows | **PKCE** (`S256`) on all Gmail OAuth starts |
| Incremental authorisation | Request **only** `send`, `read`, or `calendar` scope per step |
| Cross-Account Protection | **`POST /api/google/risc`** + store `googleSub` on connect |
| Verification | No code fix — finish Google review |

## After deploy

1. Redeploy Connect Intel (Vercel).
2. Register RISC URL in Console (step 3).
3. Existing users: reconnect work Gmail / Calendar once so new scopes + PKCE apply.
