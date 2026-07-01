# Connect Intel — Coding Standards

**Last updated:** 2026-06-24  
**Stack:** JavaScript (ES modules) · Vite · React 19 · Node 22 serverless

> **Constitution target:** TypeScript + SOLID + Clean Architecture. This document describes **current conventions** and **migration standards**.

---

## 1. Principles

| Principle | Application |
|-----------|-------------|
| **Extend, don't rewrite** | Per `CRM_PLATFORM_BLUEPRINT.md` |
| **DRY** | Shared logic in `lib/` (e.g. `dealPipeline.js` client+server) |
| **KISS** | Prefer small handlers delegating to domain modules |
| **SOLID** | Extract services incrementally; avoid god handlers |
| **Multi-tenancy** | Always scope by org/user; never trust client org id |
| **Security** | `requireUser` + `assertOrgPermission` on mutations |
| **No duplicate business logic** | One module per domain rule |

---

## 2. Repository layout

| Path | Convention |
|------|------------|
| `lib/server/handlers/` | One default export `handler(req, res)` per route |
| `lib/server/` | Domain logic — no HTTP in core modules |
| `frontend/src/components/{feature}/` | Feature panels |
| `frontend/src/lib/` | Client utilities, API, constants |
| `frontend/src/hooks/` | Reusable React hooks |
| `supabase/migrations/` | Forward SQL only, timestamped names |

---

## 3. Naming

| Entity | Convention | Example |
|--------|------------|---------|
| Handlers | `kebab-case.js` | `dashboard-bootstrap.js` |
| API routes | `segment/segment` | `crm/team-metrics` |
| React components | `PascalCase.jsx` | `HomeDashboard.jsx` |
| Hooks | `useCamelCase.js` | `useDashboardLive.js` |
| Collections | `camelCase` plural | `marketingCampaigns` |
| SQL tables | `snake_case` | `pipeline_leads` |
| Env vars | `SCREAMING_SNAKE` | `USE_PIPELINE_LEADS_TABLE` |

---

## 4. Handler pattern

```javascript
import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { assertOrgPermission, permissionDeniedResponse } from '../permissionEnforce.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  try {
    // await assertOrgPermission(user, 'view_analytics', store)
    const result = await domainFunction(user)
    return sendJson(res, 200, result)
  } catch (err) {
    const denied = permissionDeniedResponse(err)
    if (denied) return sendJson(res, denied.status, denied.body)
    return sendJson(res, 500, { error: err.message })
  }
}
```

---

## 5. Frontend patterns

- **State:** `AppContext` for global; local `useState` for panel state
- **Navigation:** `onNavigate(panel, options)` — never full page reload
- **API:** Always via `api` object — never raw `fetch` to `/api` in components
- **Styles:** Prefer `platform-design-system.css` tokens for new UI
- **Loading:** `LoadingExperience` component
- **Accessibility:** `aria-label`, landmarks, `focus-visible` on interactive elements

---

## 6. Database access

- Use `readStore({ only: [...] })` — never load full store unnecessarily
- Pipeline mutations via `updatePipelineStore` / shard helpers
- SQL via `pipelineLeadsTable.js` when flag enabled — not ad hoc SQL in handlers
- Migrations in `supabase/migrations/` — document in `DATABASE.md`

---

## 7. Error handling

- Handlers return JSON `{ error: string }` with appropriate HTTP status
- Client: `api.request` throws on non-2xx; catch in components
- Server: `captureException` (Sentry) for unexpected errors
- Never expose stack traces in production responses

---

## 8. Comments

- Code should be self-explanatory
- Comment non-obvious business rules and security constraints
- No changelog comments in code — use git + `PRODUCTION_LOG.md`

---

## 9. Testing

- Co-locate tests as `*.test.js` next to module or in same directory
- Use `node:test` and `node:assert/strict`
- Test business logic without HTTP mocks where possible
- See `TESTING.md`

---

## 10. Git & deploy

- Do not commit secrets, `frontend/dev-dist/`, or Capacitor unless in deploy scope
- Run `npm run prod:ship` before pushing to `main`
- Commit messages: complete sentences, focus on why

---

## 11. TypeScript migration (planned)

1. Add `packages/shared/` with TS types for API DTOs
2. Enable `allowJs` gradual migration in `lib/`
3. New modules in TS; JS untouched until touched
4. Do **not** big-bang convert — constitution aligned but blueprint-safe

---

## 12. Anti-patterns (do not)

- ❌ Bypass `permissionEnforce` for convenience
- ❌ Read full pipeline shard on hot paths without cache/SQL
- ❌ Put business logic in React components
- ❌ Trust `organizationId` from request body
- ❌ Force-push to `main`
- ❌ Greenfield Next.js/NestJS without explicit approval

---

## 13. Related

- `ARCHITECTURE.md`
- `CRM_PLATFORM_BLUEPRINT.md`
- `.cursor/rules/crm-platform-evolution.mdc`
- `.cursor/rules/production-deployments.mdc`
