# Add Resend DNS in Squarespace (connectintel.net)

Your domain DNS is managed by **Squarespace** (`nse1.squarespacedns.com`).  
I cannot log into your Squarespace account from here — follow these steps **exactly** (copy/paste values below).

After DNS is saved, tell Connect Intel to re-check: open  
https://connectintel.net/api/setup/resend-dns  
or use **Team → Send test invite**.

---

## Step 1 — Open DNS settings

1. Go to **https://account.squarespace.com**
2. Sign in with the account that owns **connectintel.net**
3. Click **Domains** (left menu)
4. Click **connectintel.net**
5. Open **DNS Settings** or **DNS records** / **Custom records**

---

## Step 2 — Fix Google SPF on the root domain (one TXT record only)

Find the existing **@** (or blank host) **TXT** record that looks like:

```txt
v=spf1 include:_spf.google.com ~all
```

**Edit** it (do not add a second SPF at @). Replace the whole value with:

```txt
v=spf1 include:_spf.google.com include:amazonses.com ~all
```

| Squarespace field | Value |
|-------------------|--------|
| Type | TXT |
| Host | `@` (or leave blank for root) |
| Data / Value | `v=spf1 include:_spf.google.com include:amazonses.com ~all` |

This keeps **Google Workspace** (`invite@connectintel.net` inbox) and allows **Resend** to send.

---

## Step 3 — Add 3 Resend records (Custom records)

Click **Add record** three times. Use these **exact** values from your Resend account:

### Record A — DKIM

| Field | Value |
|-------|--------|
| Type | **TXT** |
| Host | `resend._domainkey` |
| Data / Value | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDQXGF8FB64nH4OkEtBkz+svmAKvYdrVx8cakHBX3KPK9nPwrTnH8N/hJWP3MTqWoO9YBCWfiGQLwEW4jEBi7DYM7rbL/Qb3/+zjGdkMKoTREQbinGgltYNUgESDglAQfcMVpp42V9wpbuQIkNEpzZIhU2GKyG6n32HBDUt2BzuHwIDAQAB` |

### Record B — Resend mail (MX on `send`)

| Field | Value |
|-------|--------|
| Type | **MX** |
| Host | `send` |
| Mail server / Points to | `feedback-smtp.ap-northeast-1.amazonses.com` |
| Priority | `10` |

### Record C — Resend SPF (TXT on `send`)

| Field | Value |
|-------|--------|
| Type | **TXT** |
| Host | `send` |
| Data / Value | `v=spf1 include:amazonses.com ~all` |

**Save** all records.

---

## Step 4 — Verify in Resend

1. Open **https://resend.com/domains**
2. Click **connectintel.net**
3. Click **Verify DNS records**
4. Status must become **Verified** (can take 10–30 minutes after Squarespace saves)

---

## Step 5 — Test in Connect Intel

1. Open **Team** in the app
2. Banner should turn **green** (“Resend domain verified”)
3. Click **Send test invite to your email**
4. Check inbox + spam

---

## Squarespace tips

- **Host** = only the subdomain part (`send` or `resend._domainkey`), not the full `send.connectintel.net` unless Squarespace asks for the full name.
- If Squarespace appends `.connectintel.net` automatically, enter `send` not `send.connectintel.net`.
- Do **not** delete Google **MX** records (`smtp.google.com`) — only add/edit as above.

---

## Re-check status (no login)

```text
https://connectintel.net/api/setup/resend-dns
```

When `inviteEmailReady` is `true`, DNS is correct.

Trigger Resend to re-scan DNS (optional):

```text
POST https://connectintel.net/api/setup/resend-dns
```

---

## If you want someone else to click for you

Share **only** Squarespace login with a trusted person for 10 minutes, or add them as a domain admin in Squarespace — they only need Steps 1–4 above.
