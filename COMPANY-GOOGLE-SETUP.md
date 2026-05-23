# Company email only — Google Cloud + Connect Intel

**App URL:** https://connectintel.net — DNS & Vercel: [DOMAIN-SETUP.md](./DOMAIN-SETUP.md)

**Use:** `invite@connectintel.net` (company Google Workspace)  
**Do not use:** your personal Gmail for Google Cloud or Vercel keys.

The old login was on personal Google — we are **replacing** it with a **new** project on the **company** account.

---

## Before you start

1. Sign **out** of Google Cloud if you see your personal account.
2. Open an **Incognito / Private** window (recommended).
3. Sign in only as **invite@connectintel.net** (or your Workspace admin that manages the domain).

---

## Step 1 — New project (company account)

1. **https://console.cloud.google.com/**
2. Top bar → **Select project** → **New project**
3. Project name: **`Connect Intel`**
4. **Create** → wait until the dashboard opens
5. Confirm top bar shows **Connect Intel** (and your company email icon)

---

## Step 2 — OAuth consent (company app)

1. Menu → **Google Auth Platform** (or **APIs & Services** → **OAuth consent screen**)
2. **Configure** / **Get started**
3. User type: **Internal** (best for Google Workspace — only @connectintel.net users)
4. App name: **Connect Intel**
5. Support email: **invite@connectintel.net**
6. Finish the wizard (defaults are OK)

---

## Step 3 — Enable Gmail API

1. **APIs & Services** → **Library**
2. Search **Gmail API** → **Enable**

---

## Step 4 — Web OAuth client (login + invite email)

1. **Google Auth Platform** → **Clients** → **Create client**
2. Application type: **Web application**
3. Name: **Connect Intel Web**

**Authorized JavaScript origins:**

```text
https://connectintel.net
http://localhost:5173
```

**Authorized redirect URIs:**

```text
https://connectintel.net/api/team/email-oauth/callback
```

4. **Create**
5. Copy and save:
   - **Client ID** (`....apps.googleusercontent.com`)
   - **Client secret** (`GOCSPX-...`)

---

## Step 5 — Vercel (replace old personal keys)

**https://vercel.com** → **connect-intel** → **Settings** → **Environment Variables**

For **Production** (and Preview if you use it):

| Variable | What to put |
|----------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | new **Client ID** (company project) |
| `GOOGLE_CLIENT_ID` | **same** Client ID |
| `GOOGLE_CLIENT_SECRET` | new **Client secret** (company project) |
| `EMAIL_FROM` | `Connect Intel <invite@connectintel.net>` |
| `INVITE_EMAIL_PROVIDER` | `resend` (or leave; app uses OAuth when connected) |
| `RESEND_API_KEY` | keep if you have it (optional after OAuth works) |

**Delete or overwrite** any old values that came from your **personal** Google project.

**Save** → **Deployments** → **Redeploy** → wait **Ready**.

---

## Step 6 — App (company only)

1. Open **https://connectintel.net**
2. **Sign in with Google** — choose **invite@connectintel.net** (not personal Gmail)
3. Go to **Team**
4. You should see yellow: **Connect invite@connectintel.net**
5. Click it → sign in again as **invite@connectintel.net** → **Allow**
6. Green status → **Send test invite**

---

## Step 7 — Admin access (optional)

In Vercel, set **ADMIN_EMAILS** to company addresses only, e.g.:

```text
invite@connectintel.net,your-admin@connectintel.net
```

Redeploy after changing.

---

## What this fixes

| Before | After |
|--------|--------|
| Google Cloud on personal Gmail | New project on **company** account |
| No project for invite@ | **Connect Intel** project under company login |
| Team page red / no button | **GOOGLE_CLIENT_SECRET** from company client |
| Invites | Send from **invite@connectintel.net** via **Connect** button |

---

## Go live for everyone (any Google account)

See **[GO-LIVE-EVERYONE.md](./GO-LIVE-EVERYONE.md)** — switch **Audience** to **External** and **Publish app**.  
Privacy policy: **https://connectintel.net/privacy**

---

## “Restricted” — only invite@ can log in?

**That is normal** if you chose **Internal** on the OAuth consent screen.

| Who | Can open Connect Intel app? |
|-----|------------------------------|
| **@connectintel.net** (company Google) | Yes |
| **Personal Gmail** (gmail.com) | No — Google shows “restricted” |
| **Other companies’ email** | No — for app login |

**Team invite emails are different:** you can send an invite **to any email** (Gmail, etc.). They get a link in email. They only need a company `@connectintel.net` account if they should **use the app** as your employee.

### How to test team invite (use invite@ only)

1. Sign in to the app as **invite@connectintel.net**
2. **Team** → if yellow, click **Connect invite@connectintel.net** → Allow
3. When green, enter a test address (your personal Gmail is OK **as the recipient**)
4. Click **Send invite**
5. Check that Gmail inbox (and spam) — you do **not** log into the app with personal Gmail to test the email

### If you need personal Gmail to log into the app (testing only)

Google Console → **Google Auth Platform** → **Audience** → change to **External** (or add **Test users** with your personal Gmail under External). Not needed for normal company use.

---

## If Internal OAuth is not available

Your Workspace admin must enable it, or use **External** consent and add test users under **Audience** → **Test users** (add invite@ and other company emails).

---

## Connect keeps asking again?

1. On Vercel **Production**, set **`APP_URL`** = `https://connectintel.net` (empty APP_URL breaks Google OAuth).
2. Google Cloud → OAuth client → redirect URI must be exactly:  
   `https://connectintel.net/api/team/email-oauth/callback`
3. Enable **Gmail API** in the same Google project.
4. After a failed connect, open **System status** — the yellow box shows **Last connect attempt failed** with the real error.
5. Check: `https://connectintel.net/api/setup/resend-dns` → `oauthRedirectUri` and `lastOAuthError`.

---

## Team emails not sending?

Production must show invite email **connected**. If invites save but no email arrives:

1. Sign in as **invite@connectintel.net** (platform operator) or any **company admin**
2. Open **Data & imports** (platform) or **Team** (company admin)
3. Click **Connect invite@connectintel.net** → sign in with **invite@** only → Allow
4. Green **Invite email is connected** → send a test invite

Or set on Vercel (optional): `GOOGLE_INVITE_REFRESH_TOKEN` + `GOOGLE_INVITE_EMAIL=invite@connectintel.net` after one OAuth connect.

Check: `https://connectintel.net/api/setup/resend-dns` → `inviteEmailReady` should be `true`.

---

## Checklist

- [ ] Logged into Cloud Console as **company** email only  
- [ ] Project **Connect Intel** created  
- [ ] Gmail API enabled  
- [ ] Web client created with origins + redirect URI  
- [ ] Vercel updated (ID + secret) and **redeployed**  
- [ ] App sign-in with **invite@connectintel.net**  
- [ ] Team → **Connect invite@connectintel.net** → test invite sent  
