# Supabase + AI + Team invites

## 1. Supabase (required for production)

Without Supabase, Vercel uses `/tmp` and **all data is lost on cold starts**.

1. Create a project at [supabase.com](https://supabase.com)
2. **SQL Editor** → run `supabase/schema.sql`
3. **Project Settings → API**:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (never expose in the browser)

**Vercel → Environment Variables** (Production + Preview):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
APP_URL=https://connectintel.net
```

Redeploy. Check **Integrations** in the app: `storage: supabase` should be true.

On first request, local SQLite data (if any) is copied into Supabase automatically.

---

## 2. AI discovery cache (saves paid API cost)

When Perplexity, Claude, or Apollo return leads:

1. Contacts/companies are **saved into your database** (`ai-perplexity`, `ai-claude`, etc.)
2. The same search is **re-run against the database**
3. The next user (or the same user) with similar filters gets **database results** — no second Perplexity call

Customer-facing copy: *“Previously discovered leads served from your database.”*

Admin **AI research** also persists rows immediately.

---

## 3. Google Gemini

```
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.0-flash
```

Keyword expansion + CRM email drafts.

---

## 4. Perplexity

```
PERPLEXITY_API_KEY=pplx-...
PERPLEXITY_MODEL=sonar
```

Used only when the database has no matches (after Gemini keyword retry).

---

## 5. Team email invites (Resend)

```
RESEND_API_KEY=re_...
EMAIL_FROM=Connect Intel <onboarding@yourdomain.com>
APP_URL=https://your-production-url
```

- Admin invites from **Team** → email with `/?invite=TOKEN` link (7-day expiry)
- Invitee must sign in with the **same email** as the invite
- If Resend is not set, the admin still gets a **copyable invite link**

**Pipeline roles**

| Role | Kanban columns |
|------|----------------|
| Admin | All |
| Full pipeline (member) | New → Replied, Lost |
| Sales rep | New, Contacted, Follow up |

---

## Search order

1. Database (imports + built-in + **cached AI**)
2. Gemini keyword expand → retry database
3. Perplexity → **persist** → database
4. Paid Apollo/Claude only if `ENABLE_PAID_APIS=true` (also persisted)

---

## Deploy checklist

- [ ] Run `supabase/schema.sql`
- [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on Vercel
- [ ] `APP_URL` = production URL
- [ ] `PERPLEXITY_API_KEY` (optional but recommended)
- [ ] `RESEND_API_KEY` + `EMAIL_FROM` for invite emails
- [ ] Redeploy → sign out / sign in
- [ ] Team → invite a colleague → accept link
