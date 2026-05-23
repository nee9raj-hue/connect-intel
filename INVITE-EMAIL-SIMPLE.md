# invite@connectintel.net — simple setup

All team invites send **from invite@connectintel.net** via **Resend**.  
Your **Google Workspace inbox** for that address stays the same.

---

## Step 1 — Domain DNS (Google Domains → Squarespace)

1. Open **https://domains.squarespace.com**
2. **Continue with Google** (account you used to buy the domain)
3. **connectintel.net** → **DNS Settings**

### Edit 1 record

Find **TXT** at **@** and replace with (copy):

```txt
v=spf1 include:_spf.google.com include:amazonses.com ~all
```

### Add 3 records

| Type | Host | Value |
|------|------|--------|
| TXT | `resend._domainkey` | (copy from Team page in app) |
| MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` priority **10** |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |

Save all.

---

## Step 2 — Resend

1. **https://resend.com/domains**
2. Open **connectintel.net**
3. **Verify DNS records**
4. Wait until status = **Verified**

---

## Step 3 — Vercel (already partly done)

Production must have:

```env
EMAIL_FROM=Connect Intel <invite@connectintel.net>
RESEND_API_KEY=re_...
INVITE_EMAIL_PROVIDER=resend
```

Redeploy after any change.

---

## Step 4 — Test

1. Connect Intel → **Team**
2. **Re-check status** → green
3. **Send test invite** → check **invite@connectintel.net** inbox

---

## Notes

- No personal Gmail is used.
- App Passwords are not needed for `invite@connectintel.net`.
- DNS host is Squarespace Domains because you bought the domain on Google Domains (migrated automatically).
