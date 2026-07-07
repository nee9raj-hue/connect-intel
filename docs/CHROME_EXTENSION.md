# Chrome extension — constitution alignment

**Phase:** 22 Integrations (partial → extension catalog)  
**Status:** v1.0 ready for Chrome Web Store · see [CHROME_WEB_STORE.md](./CHROME_WEB_STORE.md)
**Stack:** Manifest V3 · service worker · Gmail content script · existing Vercel APIs

---

## Principle: thin client, fat server

Per [CRM_PLATFORM_BLUEPRINT.md](./CRM_PLATFORM_BLUEPRINT.md):

1. **Extend, don't replace** — extension calls `/api/*` handlers; no parallel CRM store.
2. **Workspace isolation** — `assertPipelineHubAccess`, org-scoped lead match.
3. **Audit everything** — `extension/*` actions → `audit_events`.
4. **Email policy** — trail-only sync via server ([CRM_EMAIL_TRAIL_SYNC.md](./CRM_EMAIL_TRAIL_SYNC.md), [CRM_INBOUND_EMAIL.md](./CRM_INBOUND_EMAIL.md)).

---

## Architecture

```
Gmail (user browser)
  └─ content script: participant emails (visible header only)
        └─ extension popup / background
              └─ Bearer session JWT (connect_intel_session cookie)
                    └─ connectintel.net API
                          ├─ extension/lead-match
                          ├─ extension/capture-lead
                          ├─ extension/log → audit_events
                          ├─ crm/sync-email-thread (Gmail API on server)
                          ├─ crm/generate-email (AI draft)
                          └─ crm/send-email (send + trail log)
```

---

## Auth

- User signs in on `connectintel.net` (existing Google OAuth / session).
- Extension reads `connect_intel_session` cookie via `chrome.cookies` API.
- All API calls use `Authorization: Bearer <token>` (same as web app).

No extension-specific OAuth client in v0.1.

---

## Roadmap (constitution order)

| Version | Deliverable |
|---------|-------------|
| **v0.1** ✅ | Gmail lead match, trail sync trigger, audit log |
| **v0.2** ✅ | LinkedIn / company site “Add to pipeline” (capture API + widget) |
| **v0.3** ✅ | Gmail compose helper — AI draft + send & log via `crm-send-email` |
| **v1.0** ✅ | Chrome Web Store package, listing copy, privacy disclosure (`npm run extension:package`) |
| v1.1 | Post-launch: store URL in app, auto-update telemetry |

---

## Out of scope (unless constitution amends)

- Reading full Gmail inbox in the extension
- Storing CRM data in `chrome.storage` beyond session metadata
- Greenfield extension backend (must use Vercel handlers)

---

## Related

- [EMAIL_ENGINE.md](./EMAIL_ENGINE.md) — `email_sends` audit
- [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md) — Phase 22
- [extension/README.md](../extension/README.md) — install steps
