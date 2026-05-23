# Team invite email — connectintel.net

Use **`invite@connectintel.net`** as the sender. Teammates still **reply to your Google account** (Reply-To).

## Critical: domain must exist in Resend

The app only shows **green “Resend domain verified”** when `connectintel.net` is **Verified** in your Resend account.  
Buying `invite@connectintel.net` in Google Workspace is not enough — you must add the domain in Resend and add DNS records.

**Current DNS check:** `connectintel.net` still has only Google SPF (`include:_spf.google.com`) and **no Resend DKIM** records — emails cannot deliver until these are added.

## 1. Verify domain in Resend

1. Open [resend.com/domains](https://resend.com/domains) → **Add domain** → `connectintel.net`
2. Resend shows DNS records. Add them where you manage DNS (Google Domains, Cloudflare, Namecheap, etc.).

### SPF (merge with Google Workspace)

You already have Google mail on this domain. **Do not replace** the SPF record — **edit** it to include Resend:

```txt
v=spf1 include:_spf.google.com include:amazonses.com ~all
```

(Resend sends through Amazon SES; `include:amazonses.com` is what Resend documents.)

### DKIM

Add the **3 CNAME** records Resend gives you (names like `resend._domainkey`).

### Optional but recommended

- **DMARC** TXT if Resend suggests it
- Wait until Resend shows **Verified** (often 5–30 minutes after DNS propagates)

## 2. Vercel environment variable

**Production** (and Preview if you test invites there):

```env
EMAIL_FROM=Connect Intel <invite@connectintel.net>
```

Redeploy after saving.

## 3. Test on the app

1. Open **Team** → **Send test invite to your email**
2. You should receive mail **from** `invite@connectintel.net` (display name includes your admin name)
3. **Reply** should go to your Google sign-in email
4. Invite a colleague again

## 4. Google Workspace inbox

`invite@connectintel.net` can stay in **Google Workspace** for reading mail. Resend only needs **DNS verification** on `connectintel.net` to **send** as that address; you do not move MX away from Google for invites to work.

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| Team page yellow warning about Gmail | Update `EMAIL_FROM` to `Connect Intel <invite@connectintel.net>` and redeploy |
| Resend domain not verified | Finish DKIM + SPF DNS; check [dnschecker.org](https://dnschecker.org) |
| Test email in spam | Add DMARC; warm up domain; ask recipient to mark “Not spam” |
| API says domain not verified | Wait for Resend green checkmark before inviting |

Check status: `GET https://connectintel.net/api/integrations/status` → `providers.inviteEmailReady` should be `true`.
