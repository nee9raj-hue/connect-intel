# Supabase + Gemini + Perplexity setup

## 1. Supabase (persistent database)

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** → paste and run `supabase/schema.sql`
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY`

Add on **Vercel → Environment Variables** (Production + Preview):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Redeploy. The app stores all data (users, imports, saved leads, contacts) in Supabase instead of ephemeral `/tmp`.

On first request with Supabase enabled, any existing local SQLite data is copied to Supabase automatically.

---

## 2. Google Gemini (keyword expansion + email drafts)

1. [Google AI Studio](https://aistudio.google.com/apikey) → Create API key
2. Vercel env:

```
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.0-flash
```

**Used for:**
- Expanding search keywords when the database returns no matches
- Pipeline email drafts (preferred over Claude when set)

---

## 3. Perplexity (web discovery)

1. [Perplexity API](https://www.perplexity.ai/settings/api) → API key
2. Vercel env:

```
PERPLEXITY_API_KEY=pplx-...
PERPLEXITY_MODEL=sonar
```

**Used for:**
- **Customer search:** when database + Gemini still find nothing → up to 8 AI-discovered leads (label: *AI discovery — verify contacts*)
- **Admin → AI research (Perplexity):** manual research before Excel import

---

## Search order (automatic)

1. Your database (imports + built-in India data)
2. **Gemini** — broader keywords, retry database
3. **Perplexity** — web-informed suggestions
4. Paid Apollo/Claude only if `ENABLE_PAID_APIS=true`

---

## After deploy checklist

- [ ] Run `supabase/schema.sql`
- [ ] Set all three keys on Vercel
- [ ] Redeploy
- [ ] Sign out / sign in
- [ ] Admin: import your Excel OR run Perplexity research
- [ ] Search: `exporter` + Rajasthan + Jaipur
