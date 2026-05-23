# Team invite emails — complete setup

Connect Intel can send team invites two ways (auto-picks the best):

| Method | DNS needed? | Vercel variables |
|--------|-------------|------------------|
| **Gmail SMTP** (recommended) | **No** | `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD` |
| **Resend** | Yes (Squarespace Domains DNS) | `RESEND_API_KEY`, verified domain |

Set `INVITE_EMAIL_PROVIDER=auto` (default).

---

## Option A — Gmail SMTP (5 minutes, no DNS)

Works with **Google Workspace** for `invite@connectintel.net`.

### 1. Create a Google App Password

1. Sign in as `invite@connectintel.net` (or Workspace admin → Users → invite@…).
2. Google Account → **Security** → turn on **2-Step Verification**.
3. **App passwords** → App: Mail, Device: Other → name: `Connect Intel`.
4. Copy the **16-character** password (no spaces).

### 2. Vercel → Environment Variables (Production)

```env
EMAIL_FROM=Connect Intel <invite@connectintel.net>
GMAIL_SMTP_USER=invite@connectintel.net
GMAIL_SMTP_APP_PASSWORD=xxxx xxxx xxxx xxxx
INVITE_EMAIL_PROVIDER=auto
```

Remove spaces from the app password when pasting.

### 3. Redeploy and test

**Team** → **Send test invite to your email**.

---

## Option B — Resend + DNS (Google Domains → Squarespace)

You bought the domain on **Google Domains**; DNS is now at **domains.squarespace.com** (same Google login).

1. https://domains.squarespace.com → **connectintel.net** → DNS
2. Add records from https://connectintel.net/setup-dns
3. https://resend.com/domains → **Verify**
4. Vercel: `RESEND_API_KEY`, `EMAIL_FROM=Connect Intel <invite@connectintel.net>`

---

## Check status

- App **Team** page (green = ready)
- API: `GET /api/setup/resend-dns` or `/api/team/invite-email`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| “Invite email is not configured” | Add Gmail App Password (Option A) |
| Gmail “Invalid login” | Use App Password, not normal password |
| Resend `not_started` | Complete DNS at Squarespace Domains |
| No email in inbox | Check spam; confirm green status on Team page |
