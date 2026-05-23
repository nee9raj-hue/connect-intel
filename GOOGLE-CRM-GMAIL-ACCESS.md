# Fix “Google hasn’t verified this app” (CRM work Gmail)

Connect Intel uses scope **`gmail.send`** so CRM can send from the rep’s work mailbox. Google treats that as **sensitive** until the app is verified.

**Sign-in with Google** works for everyone; **Connect work Gmail** does not until one of the fixes below.

See also [PRODUCTION-EMAIL.md](./PRODUCTION-EMAIL.md) and [CRM-EMAIL-INTEGRATION-OPTIONS.md](./CRM-EMAIL-INTEGRATION-OPTIONS.md).

---

# Fix “Google hasn’t verified this app”

When a rep clicks **Connect work Gmail**, Google shows this because Connect Intel requests **`gmail.send`** (send email on the user’s behalf). That scope is **sensitive** until Google verifies your OAuth app.

**Sign-in with Google** can work for everyone; **CRM Gmail send** has stricter rules.

---

## What reps can do right now (if admin added them as test users)

1. On the Google screen, click **Advanced** (bottom left).
2. Click **Go to Connect Intel (unsafe)**.
3. Choose the **company** account (e.g. `sales@alvarfresh.com`), not personal Gmail.
4. Click **Allow**.

If there is **no** Advanced link, the account is **not** on the test-user list (or the app is blocked until verification).

---

## What Connect Intel admin must do (invite@connectintel.net)

Use the **same** Google Cloud project as login (`Connect Intel`).

### 1. OAuth user type must be **External**

**Internal** only allows `@connectintel.net` Workspace users.  
Customers like **Alvar Fresh** (`@alvarfresh.com`) need **External**.

1. [Google Cloud Console](https://console.cloud.google.com/) → project **Connect Intel**
2. **Google Auth Platform** → **Audience** (OAuth consent screen)
3. User type: **External** (if you need non–Connect Intel emails)

### 2. Add every CRM user as a **Test user** (quick fix, up to 100 emails)

While the app is **Testing** (or unverified in production):

1. **Audience** → **Test users** → **Add users**
2. Add each rep, e.g.:
   - `sales@alvarfresh.com`
   - any other teammate who will use **Connect work Gmail**
3. Save

Reps must use the **exact** email you added.

### 3. App domain & privacy (required for verification later)

**Branding** / **App domain**:

| Field | Value |
|--------|--------|
| Application home page | `https://connectintel.net` |
| Privacy policy | `https://connectintel.net/privacy.html` |

**Data access** → scopes should include:

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/userinfo.email`

### 4. Production vs Testing

| Mode | Sign-in (all users) | CRM Gmail (`gmail.send`) |
|------|---------------------|---------------------------|
| **Testing** + test users | Test users only | Test users only; warning + **Advanced** |
| **In production**, not verified | Often OK for basic login | **Blocked** or warning for most users |
| **In production**, verified | Everyone | Everyone |

For **many customers**, you eventually need **Google OAuth verification** for `gmail.send` (see below).

---

## Long-term: verify the app with Google

1. **Audience** → **Publish app** (when branding, privacy, and scopes are complete).
2. If Google flags **gmail.send**, open **Verification center** and submit:
   - Why you need send mail (CRM outreach from the customer’s own mailbox)
   - Link to privacy policy
   - Short demo video (sign in → connect Gmail → send test email)
3. Restricted scopes may require a **security assessment** (CASA) — plan several weeks.

Until verification is approved, keep customer reps on **Test users** (max 100) or they cannot connect Gmail reliably.

---

## Alternatives if you cannot verify yet

| Option | Notes |
|--------|--------|
| **Test users** | Best short-term fix for Alvar Fresh |
| **Resend** | Already used for **team invites** only; not wired to CRM “send as rep” |
| **mailto:** | Old behavior; no Gmail Sent sync |
| **Customer’s own Google Cloud project** | Not supported in product today |

---

## Checklist for Alvar Fresh today

- [ ] Cloud project OAuth type = **External**
- [ ] `sales@alvarfresh.com` (and each rep) added under **Test users**
- [ ] Rep uses **Advanced → Go to Connect Intel (unsafe)** on the warning screen
- [ ] Rep connects **work** Gmail, not `@gmail.com` personal

Support: after changes, wait ~5 minutes, then try **Connect work Gmail** again in an incognito window.
