# Let anyone sign in with Google (go live)

The app already allows **any Google account** to register. The “restricted” message comes from Google **Internal** OAuth — change it in Google Console (not Vercel).

---

## Step 1 — Open Google Cloud (company project)

1. **https://console.cloud.google.com** as **invite@connectintel.net**
2. Select project **Connect Intel**

---

## Step 2 — Change to External (everyone)

1. **Google Auth Platform** → **Audience** (left menu)
2. Under **User type**, click **Make external** (or **Publish app** / switch from Internal)
3. Confirm **External**

---

## Step 3 — App information (if Google asks again)

| Field | Value |
|-------|--------|
| App name | Connect Intel |
| Support email | invite@connectintel.net |
| Home page | https://connectintel.net |
| Privacy policy | https://connectintel.net/privacy |
| Authorized domains | connectintel.net |

Save.

---

## Step 4 — Scopes

**Google Auth Platform** → **Data access** (Scopes)

For **sign-in only**, you need non-sensitive scopes (usually added automatically):

- `openid`
- `email`
- `profile`

For **Team invite email** (Connect button), you also need:

- `https://www.googleapis.com/auth/gmail.send`

If Google asks to verify the app for `gmail.send`, you can publish for login first and complete verification later, or use Resend + DNS for email only.

---

## Step 5 — Publish the app (live for all)

1. **Audience** page
2. Click **Publish app** (or **Go to production**)
3. Confirm

Status should show **In production** — any Google user can sign in.

### Still in “Testing”?

- Add emails under **Test users** (up to 100), **or**
- Complete **Publish app** (recommended for “everyone”)

---

## Step 6 — OAuth client URLs (check once)

**Clients** → your Web client:

**Authorized JavaScript origins:**

```text
https://connectintel.net
```

**Authorized redirect URIs:**

```text
https://connectintel.net/api/team/email-oauth/callback
```

Save.

---

## Step 7 — Vercel (no change needed for public login)

Keep:

- `VITE_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Redeploy only if you changed keys.

---

## Step 8 — Test

1. Open **https://connectintel.net** in Incognito
2. **Continue with Google** using **personal Gmail** — should work (no “restricted”)
3. Complete onboarding
4. As **invite@**, open **Team** → **Connect invite@connectintel.net** → send test invite

---

## Who is platform admin?

`ADMIN_EMAILS` on Vercel only controls **platform operator** features (master data import), not who can log in.

Example:

```text
invite@connectintel.net
```

Anyone else gets a normal customer account.

---

## Summary

| Goal | Where |
|------|--------|
| Anyone can log in | Google → Audience → **External** → **Publish app** |
| Privacy URL | https://connectintel.net/privacy |
| Team invite email | Team → **Connect invite@connectintel.net** (invite@ signs in) |
