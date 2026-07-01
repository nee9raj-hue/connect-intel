# Connect Intel — Testing Strategy

**Last updated:** 2026-06-24

---

## 1. Current state

| Type | Status |
|------|--------|
| Unit tests | 23 files (`*.test.js` under `lib/`) |
| Integration tests | Minimal |
| E2E tests | None in CI |
| CI gate | Build + handler imports only |
| `npm test` script | **Missing** |

**Constitution requirement:** Mandatory unit tests for business logic + CI gate — **not met**.

---

## 2. Test runner

Node.js built-in test runner:

```bash
node --test lib/server/**/*.test.js lib/**/*.test.js
```

Example files:
- `lib/server/pipelineLeadsTable.test.js`
- `lib/server/repSummary.test.js`
- Pipeline visibility / permission related tests

---

## 3. CI pipeline

**File:** `.github/workflows/ci.yml`

Current steps:
1. `npm ci` (root + frontend)
2. `node scripts/verify-deploy.mjs`
3. Frontend production build
4. Server handler import smoke

**Gap:** No `npm test` step.

---

## 4. Recommended test pyramid

```
        ┌─────────┐
        │  E2E    │  Playwright — critical paths (login, pipeline, send)
       ┌┴─────────┴┐
       │ Integration│  Handler + DB fixtures (Supabase local)
      ┌┴────────────┴┐
      │  Unit tests   │  Domain logic, permissions, deal flatten, workflows
      └───────────────┘
```

---

## 5. Priority test targets

| Module | Why |
|--------|-----|
| `permissionEnforce.js` | Security-critical |
| `tenantWriteGuard.js` | Tenancy |
| `dealPipeline.js` | Shared client/server |
| `automationGraphRunner.js` | Workflow correctness |
| `dashboardBootstrap.js` | Dashboard regressions |
| `marketingEmailQueue.js` | Revenue path |
| `pipelineLeadsTable.js` | Scale path |

---

## 6. Test data strategy

| Environment | Data |
|-------------|------|
| Local dev | `data/connect-intel.sqlite` JSON store |
| Unit tests | In-memory fixtures; mock `readStore` |
| Integration | Supabase branch / docker (planned) |
| E2E | Dedicated staging org on Vercel preview |

---

## 7. Planned `npm test` script

```json
"test": "node --test 'lib/**/*.test.js' 'lib/server/**/*.test.js'",
"test:watch": "node --test --watch 'lib/**/*.test.js'"
```

Add to CI after fixing any failing tests.

---

## 8. E2E scope (Phase 25)

Minimum smoke flows:
1. Google auth (or test bypass in staging)
2. Create lead → save → appears in pipeline
3. Dashboard loads KPIs
4. Send test email (staging Resend)
5. Marketing campaign draft (no prod send)

**Tool:** Playwright recommended (constitution: production-ready).

---

## 9. Acceptance criteria for testing phase

- [ ] `npm test` in root package.json
- [ ] CI fails on test regression
- [ ] 80%+ coverage on `permissionEnforce`, `tenantWriteGuard`, `dealPipeline`
- [ ] E2E smoke on preview deploy (optional gate)

---

## 10. Related

- `RELEASE_CHECKLIST.md` — manual smoke
- `PROJECT_ROADMAP.md` Phase 1, 25

**Implementation blocked until testing strategy approved.**
