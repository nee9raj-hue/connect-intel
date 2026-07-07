# Connect Intel — Chrome extension

Constitution-aligned browser companion for **Phase 22 Integrations**. Thin client only — all CRM logic stays on Connect Intel servers.

## What it does

| Feature | Constitution alignment |
|---------|------------------------|
| **Gmail lead match** | Matches visible participant emails to pipeline leads (workspace-scoped RBAC) |
| **Trail sync** | Calls `POST /api/crm/sync-email-thread` — server-side trail-only import |
| **LinkedIn / site capture** | `POST /api/extension/capture-lead` — add profile or page to pipeline (audited) |
| **Activity log** | `POST /api/extension/log` → `audit_events` + workspace pulse |
| **Open in app** | Deep link to pipeline lead in Connect Intel |

## What it does NOT do

- No bulk inbox download or storage in the extension
- No scraping unrelated mail — trail sync uses existing Gmail OAuth on the server
- No separate auth system — uses your Connect Intel session cookie / Bearer JWT

## Install (developer / unpacked)

1. Deploy or use production APIs (`https://connectintel.net`).
2. Sign in at [connectintel.net](https://connectintel.net) in Chrome (same profile).
3. Open `chrome://extensions` → **Developer mode** → **Load unpacked**.
4. Select this folder: `extension/`.
5. **Gmail** — floating button on threads. **LinkedIn** (`/in/…`) — floating **Add to pipeline** widget. **Other sites** — toolbar popup → Add to pipeline.

After reloading the extension, Gmail and LinkedIn tabs reload automatically (v0.3.0+).

## API routes (server)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/extension/bootstrap` | GET | Session, Gmail status, capabilities |
| `/api/extension/lead-match` | POST | Match Gmail context → pipeline leads |
| `/api/extension/capture-lead` | POST | Add LinkedIn / page capture to pipeline |
| `/api/extension/log` | POST | Audited extension actions |
| `/api/crm/sync-email-thread` | POST | Trail sync (existing) |

## Local API base

For `vercel dev`, change `API_BASE` in `extension/lib/api.js` to `http://localhost:3000` and sign in on that origin.

## Privacy

Participant emails are sent to Connect Intel only to match leads you already have permission to view. See [GOOGLE_CASA_AND_VERIFICATION.md](../docs/GOOGLE_CASA_AND_VERIFICATION.md) for OAuth scope policy.
