# Connect Intel — Free mode (no paid APIs)

By default the app works **without** Apollo.io or Claude paid accounts.

## What works for free

| Feature | How |
|---------|-----|
| Sign in with Google | Free |
| Search leads | **12+ built-in India exporters** (Jaipur, Mumbai, etc.) |
| Filters | States, cities, industries, keywords |
| Save leads & export CSV | Yes |
| Unlock contacts | Trial credits (first 5 full previews free) |
| Admin Excel import | Yes (add your own rows) |

## How to search

1. Sign in
2. **Find people** → Source: **Free database**
3. Try: `exporter` + city **Jaipur** + state **Rajasthan**
4. You should see real names, companies, emails (masked until unlock)

## Add your own data (admin)

1. Set `ADMIN_EMAILS` on Vercel to your Gmail
2. Sign in → **Admin** → Download Excel template
3. Fill rows → Import
4. Search again (imports work on the same server instance; for permanent storage use Postgres later)

## Enable paid APIs later (optional)

On Vercel, add:

```env
ENABLE_PAID_APIS=true
APOLLO_API_KEY=master-key-here
ANTHROPIC_API_KEY=sk-ant-...
```

Redeploy. Then you can pick Apollo or Claude in the search source dropdown.

## Why Apollo showed 401

Apollo needs a **paid plan + master API key**. Free mode skips Apollo so customers still get results.
