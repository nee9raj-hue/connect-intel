# CRM email: how HubSpot-style CRMs connect company mail (without customer DNS)

Customers often refuse **DNS changes** for a vendor. This doc compares what major CRMs do and what Connect Intel should offer.

## What HubSpot, Salesforce, and similar products actually use

| Approach | Customer DNS? | Sends from `@customer.com`? | Typical UX |
|----------|---------------|-----------------------------|------------|
| **Mailbox OAuth (Gmail / Microsoft 365)** | No | Yes — user’s real inbox | “Connect your email” once per rep |
| **CRM relay + verified domain (Resend, SendGrid, etc.)** | Yes (SPF/DKIM) | Yes | Admin adds DNS once for whole team |
| **Shared CRM inbox only** | No | No — mail from `notifications@crm.com` | Low trust for B2B sales |
| **Email forwarding / BCC to CRM** | No | N/A (inbound sync) | Log replies, not ideal for outbound |

**HubSpot’s default for most teams:** each user connects **Gmail or Outlook** via OAuth. Outbound sends through **their** mailbox; CRM logs the activity. No DNS on the customer domain for that path.

**DNS** is used when the product sends **on behalf of** the domain from the vendor’s servers (marketing email, bulk, or “send without opening Gmail”). That is our current **Resend domain** flow.

## Recommended Connect Intel product strategy

### Tier 1 — No DNS (ship first, like HubSpot)

1. **Google Workspace / Gmail — OAuth `gmail.send`**
   - Rep clicks **Connect work Gmail** in CRM (already built).
   - Platform completes **one-time Google app verification** (Connect Intel owner, not each customer).
   - Sends from `sales@customer.com`; copy can sync to Gmail Sent.
   - **Limitation:** Google “unverified app” until verification; Testing mode capped at 100 test users unless verified.

2. **Microsoft 365 / Outlook — OAuth** (roadmap)
   - Same pattern: `Mail.Send` delegated permission.
   - Often easier enterprise adoption than Gmail for Indian B2B.

3. **Log-only fallback**
   - `mailto:` + paste sent copy into activity log (already partially supported).

### Tier 2 — Optional DNS (power users / bulk)

- Keep **Team → Outbound email (Resend)** for companies that *will* add DNS once (whole team, no per-user OAuth).
- Position as **“Advanced — no Gmail connect per rep”**, not the only path.

### Tier 3 — Inbound sync (later)

- Gmail/Outlook **read** scopes or forwarding address to attach **replies** to pipeline leads (HubSpot does this after OAuth).

## Why customers skip DNS

- IT owns DNS; sales cannot change it.
- Fear of deliverability / security reviews.
- They already live in Gmail/Outlook and want sends from there.

## What we should say in the product UI

- **Default CTA:** “Connect your work Gmail” (no DNS).
- **Secondary:** “Set up company sending domain” (DNS, for admins who prefer centralized sending).
- Do **not** block CRM email on DNS alone.

## Platform owner actions (Connect Intel)

| Item | Purpose |
|------|---------|
| Complete **Google OAuth verification** for `gmail.send` | Unlimited customers on Gmail path |
| Add **Microsoft OAuth** app | Outlook customers without DNS |
| Keep **Resend domain** | Teams that accept one DNS setup |

## References

- [PRODUCTION-EMAIL.md](./PRODUCTION-EMAIL.md) — Resend domain (DNS) path  
- [GOOGLE-CRM-GMAIL-ACCESS.md](./GOOGLE-CRM-GMAIL-ACCESS.md) — Gmail OAuth troubleshooting  
