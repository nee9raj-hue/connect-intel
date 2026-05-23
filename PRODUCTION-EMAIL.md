# Production email for unlimited customers

## What you cannot automate (Google’s rules)

Connect Intel **cannot** programmatically:

- Add users to Google OAuth **Test users** (no API exists)
- Remove the **100-user test cap** on Testing mode
- Skip **Google verification** for `gmail.send` for unlimited strangers using **one** OAuth app

That is why manual test users are a dead end for a product you promote to the masses.

## What we do instead (automatic from the panel)

### Company domain sending (recommended)

1. Company admin signs in with **work email** (e.g. `sales@alvarfresh.com`).
2. **Team → Outbound email (CRM)** runs **automatic setup**:
   - Registers `alvarfresh.com` in Resend via API
   - Shows DNS records in the UI
3. Admin adds DNS at their registrar (one time).
4. Admin clicks **Check DNS verification** (calls Resend API).
5. **Every** teammate with `@alvarfresh.com` can send from CRM — **no per-user Google steps**, **no 100 cap**.

Reps only sign in with Google using their company address (already required).

### Optional Gmail OAuth

- Only needed if you want copies in **Gmail Sent** via Google’s API.
- Requires **one-time** Google app verification by Connect Intel (platform owner), not each customer.
- Not required for mass CRM sending.

## Platform owner (Connect Intel) checklist

| Task | Who | Frequency |
|------|-----|-----------|
| `RESEND_API_KEY` on Vercel | Platform | Once |
| Google OAuth verification for optional Gmail | Platform | Once |
| DNS for customer domain | Customer admin | Once per company (guided in app) |

## Customer experience

- No contact with Connect Intel support for Google test users
- No Google Cloud Console for customers
- Admin: Team → Outbound email → DNS → verify → whole team sends
