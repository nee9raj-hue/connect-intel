# One-click invite email (invite@connectintel.net)

No DNS. No Squarespace. One button on **Team**.

## For you (2 minutes)

1. Open Connect Intel → **Team**
2. Click **Connect invite@connectintel.net**
3. When Google opens, sign in as **invite@connectintel.net** (company mailbox password)
4. Allow permissions
5. You return to the app → green **Invite emails active**
6. Click **Send test invite**

## For developer (once) — Google Cloud

If the yellow button does not appear, add **GOOGLE_CLIENT_SECRET** on Vercel:

1. https://console.cloud.google.com → same project as `GOOGLE_CLIENT_ID`
2. **APIs & Services** → enable **Gmail API**
3. **Credentials** → your OAuth 2.0 Web client (or create one)
4. **Authorized redirect URIs** add:
   - `https://connectintel.net/api/team/email-oauth/callback`
5. Copy **Client secret** → Vercel **GOOGLE_CLIENT_SECRET** (Production)
6. Redeploy
