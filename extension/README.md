# Connect Intel — Chrome extension

Constitution-aligned browser companion for **Phase 22 Integrations**. Thin client only — all CRM logic stays on Connect Intel servers.

## Install

### Chrome Web Store (recommended for teams)

1. Install **Connect Intel** from the Chrome Web Store.  
   _(After first publish, the URL will be listed in [CHROME_WEB_STORE.md](../docs/CHROME_WEB_STORE.md).)_
2. Sign in at [connectintel.net](https://connectintel.net) in the **same Chrome profile**.
3. Open Gmail or LinkedIn — use the floating orange button.

### Developer / unpacked (internal QA)

1. Sign in at [connectintel.net](https://connectintel.net).
2. `chrome://extensions` → **Developer mode** → **Load unpacked** → select this `extension/` folder.
3. Reload Gmail / LinkedIn tabs after updates.

**Package for store upload:** `npm run extension:package` → `dist/connect-intel-chrome-extension-*.zip`

## What it does

| Feature | Constitution alignment |
|---------|------------------------|
| **Gmail lead match** | Matches visible participant emails to pipeline leads (workspace-scoped RBAC) |
| **Trail sync** | Calls `POST /api/crm/sync-email-thread` — server-side trail-only import |
| **Gmail compose** | AI draft (`crm-generate-email`) + **Send & log** (`crm-send-email`) from matched thread |
| **LinkedIn / site capture** | `POST /api/extension/capture-lead` — add profile or page to pipeline (audited) |
| **Activity log** | `POST /api/extension/log` → `audit_events` + workspace pulse |
| **Open in app** | Deep link to pipeline lead in Connect Intel |

## What it does NOT do

- No bulk inbox download or storage in the extension
- No scraping unrelated mail — trail sync uses existing Gmail OAuth on the server
- No separate auth system — uses your Connect Intel session cookie / Bearer JWT

## API routes (server)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/extension/bootstrap` | GET | Session, Gmail status, capabilities |
| `/api/extension/lead-match` | POST | Match Gmail context → pipeline leads |
| `/api/extension/capture-lead` | POST | Add LinkedIn / page capture to pipeline |
| `/api/extension/log` | POST | Audited extension actions |
| `/api/crm/sync-email-thread` | POST | Trail sync (existing) |
| `/api/crm-generate-email` | POST | AI email draft for matched lead |
| `/api/crm-send-email` | POST | Send from work Gmail + log to trail |

## Local API base

For `vercel dev`, change `API_BASE` in `extension/lib/api.js` to `http://localhost:3000` and sign in on that origin. **Do not ship store builds with localhost.**

## Privacy

Participant emails are sent to Connect Intel only to match leads you already have permission to view.

- Privacy policy: https://connectintel.net/privacy.html  
- Store listing copy: [store/LISTING.md](./store/LISTING.md)  
- OAuth / CASA: [GOOGLE_CASA_AND_VERIFICATION.md](../docs/GOOGLE_CASA_AND_VERIFICATION.md)
