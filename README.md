# Connect Intel

B2B lead search & outreach — Google sign-in, AI people search, lists & export.

## Open the app (this folder)

| File | What it does |
|------|----------------|
| **`index.html`** | Main app — deploy this + `assets/` folder |
| `connect-ai.html` | Redirects to `index.html` (legacy prototype kept with `?legacy`) |
| `frontend/` | Source code — edit here, then rebuild |

### Build & refresh `index.html`

```bash
npm run deploy:copy
```

### Local preview

```bash
npx serve .
# Open http://localhost:3000
```

## Go live for others

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for:

- Vercel / Netlify / Cloudflare / GitHub Pages
- Custom domain (`connectintel.com`)
- GitHub setup
- Backend & API keys before public launch
- Enterprise integrations roadmap (Salesforce, HubSpot, Apollo.io, etc.)

**Recommended:** GitHub + **Vercel** + custom domain.

## Development

```bash
npm run dev          # hot reload at localhost:5173
```
