# Apollo.io integration — Connect Intel

Connect Intel uses Apollo’s **People API Search** and **People Enrichment** on the server only.

## 1. Get an API key (must be **master**)

1. Sign in at [apollo.io](https://www.apollo.io)
2. Open **[Developer dashboard → API Keys](https://developer.apollo.io/)** (or Settings → Integrations → Apollo API)
3. Click **Create new key**
4. Turn on **Set as master key** (required for People API Search)
5. Enable access to **People API Search** (and People Enrichment if listed)
6. Copy the **full** key once — no spaces before/after

If you see **401** in Connect Intel, your key is wrong, not master, or was regenerated. Create a new master key and update Vercel.

## 2. Add to Vercel

1. [vercel.com](https://vercel.com) → your **connect-intel** project
2. **Settings → Environment Variables**
3. Add:

| Name | Value |
|------|--------|
| `APOLLO_API_KEY` | your master API key |

4. Enable for **Production** (and Preview if needed)
5. **Redeploy**

## 3. Local development

In the project root `.env` (not committed):

```env
APOLLO_API_KEY=your-master-api-key
```

Run with Vercel dev so `/api` routes work:

```bash
npx vercel dev
```

## 4. How it works in the app

| Step | API | Notes |
|------|-----|--------|
| Search | `POST /mixed_people/api_search` | No email/phone in results; masked in UI |
| Unlock | `POST /people/match` | Reveals email; uses Apollo credits |
| Order | Import DB → Apollo → Claude → demo | **Auto** mode in Find people |

## 5. Test

1. Sign in on the app
2. **Find people** → Source: **Apollo.io** (or Auto)
3. Keywords: `export manager`, State: **Rajasthan**, City: **Jaipur**
4. Search → results should show **Apollo.io** badge
5. Unlock a row → email from Apollo enrichment (uses your trial credits + Apollo credits)

## 6. Troubleshooting

| Issue | Fix |
|-------|-----|
| Apollo option disabled | Add `APOLLO_API_KEY` and redeploy |
| 401 / invalid key | Use a **master** key |
| No India results | Narrow filters; use Admin import for Indian exporters |
| Unlock fails | Person may lack email in Apollo; try another lead |
| Empty search | Broaden keywords or switch to Auto |

## Reference

- [People API Search](https://docs.apollo.io/reference/people-api-search)
- [People Enrichment](https://docs.apollo.io/reference/people-enrichment)
