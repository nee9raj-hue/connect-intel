# CRM inbound email (reply sync without gmail.readonly)

Connect Intel routes lead **replies** through a platform inbound address instead of reading the rep's Gmail inbox. This avoids the **`gmail.readonly`** restricted scope and CASA Tier 2 assessment for reply sync.

## How it works

1. **Outbound CRM send** (Gmail `gmail.send` or org Resend) sets:
   - `Reply-To: "rep@company.com" <sync-{leadId}-{sig}@…>` — the lead sees the rep's work email; routing uses the inbound address
   - `Message-ID` for threading when forwarding back to the rep
2. **Lead replies** (their mail client uses Reply-To; CRM still receives via the hidden routing address).
3. **Resend inbound** receives the message and POSTs to `/api/crm/email-inbound`.
4. **Connect Intel**:
   - Appends the reply to the lead CRM timeline
   - **Forwards a copy** to the rep's work mailbox (Gmail/Outlook) with `In-Reply-To` headers

Replies appear in **both** the CRM and the rep's inbox.

## Platform setup (Connect Intel admin)

### 1. Resend inbound domain

1. [Resend → Domains](https://resend.com/domains) → add **`inbound.connectintel.net`** (or use a Resend-managed receiving domain).
2. Add the **MX records** Resend provides for that subdomain.
3. Enable **Receiving** for the domain in Resend.

### 2. Webhook

1. [Resend → Webhooks](https://resend.com/webhooks) → **Add webhook**
2. URL: `https://connectintel.net/api/crm/email-inbound`
3. Event: **`email.received`**
4. Copy the signing secret → Vercel env **`RESEND_WEBHOOK_SECRET`** (optional but recommended)

### 3. Vercel environment variables

| Variable | Example | Purpose |
|----------|---------|---------|
| `RESEND_API_KEY` | `re_…` | Already used for invites; also fetches inbound body + forwards |
| `CRM_INBOUND_EMAIL_DOMAIN` | `inbound.connectintel.net` | Reply-To domain (default if unset) |
| `CRM_INBOUND_FORWARD_FROM` | `Connect Intel <sync@connectintel.net>` | From address when forwarding to rep |
| `CRM_INBOUND_EMAIL_SECRET` | random 32+ chars | Signs lead addresses (defaults to OAuth state secret) |
| `RESEND_WEBHOOK_SECRET` | whsec_… | Verify inbound webhook signatures |

### 4. Forward-from domain

Ensure **`connectintel.net`** (or whatever you use in `CRM_INBOUND_FORWARD_FROM`) is verified in Resend for sending forwards.

## Google OAuth scopes (reps)

- **Required:** `gmail.send` + `userinfo.email` — send only
- **Removed:** `gmail.readonly` — no longer requested for reply sync

Reps connect work Gmail once; they do **not** grant inbox read access.

## User-facing behavior

- Email tab shows: *Replies log in CRM automatically and forward to your work inbox*
- Legacy **Sync trail** button is hidden when inbound sync is enabled
- Manual **Log reply** remains as fallback

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Replies not in CRM | Resend → Emails → Inbound; webhook delivery log |
| Rep not getting forward | `CRM_INBOUND_FORWARD_FROM` domain verified; rep mailbox on user profile |
| Wrong lead | Address tampering blocked by HMAC signature on `sync-{leadId}-{sig}` |

## API

- `POST /api/crm/email-inbound` — Resend webhook (no session auth)
