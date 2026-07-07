# Connect Intel — Chrome extension (Gmail)

Constitution-aligned browser companion for **Phase 22 Integrations**. Thin client only — all CRM logic stays on Connect Intel servers.

## What it does

| Feature | Constitution alignment |
|---------|------------------------|
| **Lead match** | Matches visible Gmail participant emails to pipeline leads (workspace-scoped RBAC) |
| **Trail sync** | Calls `POST /api/crm/sync-email-thread` — server-side trail-only import ([CRM_EMAIL_TRAIL_SYNC.md](../docs/CRM_EMAIL_TRAIL_SYNC.md)) |
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
5. Open Gmail → use the **floating Connect Intel button** (bottom-right) or the toolbar icon.

After reloading the extension, Gmail tabs reload automatically (v0.2.5+). Click **Clear all** on the Errors page — old errors stay listed until cleared. If you still see `content/gmail.js` errors, that file was removed; close and reopen Gmail.

## API routes (server)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/extension/bootstrap` | GET | Session, Gmail status, capabilities |
| `/api/extension/lead-match` | POST | `{ emails: [] }` → pipeline matches |
| `/api/extension/log` | POST | Audited extension actions |
| `/api/crm/sync-email-thread` | POST | Trail sync (existing) |

## Local API base

For `vercel dev`, change `API_BASE` in `extension/lib/api.js` to `http://localhost:3000` and sign in on that origin.

## Privacy

Participant emails are sent to Connect Intel only to match leads you already have permission to view. See [GOOGLE_CASA_AND_VERIFICATION.md](../docs/GOOGLE_CASA_AND_VERIFICATION.md) for OAuth scope policy.
