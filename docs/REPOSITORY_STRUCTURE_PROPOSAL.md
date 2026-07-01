# Repository Structure Proposal

**Last updated:** 2026-06-24  
**Status:** Proposal — **requires approval before restructuring**

This proposal aligns the repo with enterprise SaaS conventions while **minimizing disruption** to the working Vite + Vercel monolith.

---

## 1. Current vs proposed

### Current (monolith)

```
connect-intel/
├── api/                 # Vercel entry
├── lib/server/          # Backend + domain
├── frontend/            # SPA source
├── supabase/            # SQL migrations
├── workers/             # Railway
├── scripts/             # Ops
├── docs/                # Documentation
└── site/                # Build output
```

### Proposed (evolutionary)

```
connect-intel/
├── apps/
│   ├── web/                    # ← rename frontend/ (optional)
│   └── api/                    # ← move api/index.js (optional; Vercel path sensitive)
├── packages/
│   ├── shared/                 # Types, DTOs, constants (TS)
│   ├── domain/                 # Pure business logic (extract from lib/server)
│   └── email-templates/        # Shared template assets
├── backend/                    # Alias documentation → lib/server during migration
│   └── lib/server/             # Keep path until Vercel config updated
├── database/
│   ├── migrations/             # ← symlink or move supabase/migrations
│   ├── seeds/
│   └── schema.md               # → DATABASE.md
├── infrastructure/
│   ├── terraform/              # NEW — Vercel/Railway/Supabase modules
│   ├── docker/
│   │   └── docker-compose.yml  # Local: Supabase + Redis + Meilisearch
│   └── kubernetes/             # Future — not required for current scale
├── workers/                    # Unchanged
├── scripts/                    # Unchanged
├── tests/
│   ├── unit/                   # → lib/**/*.test.js
│   ├── integration/
│   └── e2e/                    # Playwright
├── design-system/              # Extract platform-design-system (optional)
│   └── tokens/
├── docs/                       # All architecture docs (current)
└── site/                       # Build output (unchanged)
```

---

## 2. Migration phases (non-breaking)

### Phase A — Documentation only (NOW)

- Keep physical paths unchanged
- Add `docs/ARCHITECTURE.md` index pointing to real paths
- Add `tests/README.md` pointing to `lib/**/*.test.js`

### Phase B — `packages/shared` (low risk)

```
packages/shared/
├── package.json
├── tsconfig.json
├── src/
│   ├── types/
│   │   ├── pipeline.ts
│   │   ├── permissions.ts
│   │   └── api-responses.ts
│   └── constants/
│       └── crmStatuses.ts
```

- Frontend + server import via workspace package
- No Vercel path changes

### Phase C — Extract `services/` inside `lib/server/`

```
lib/server/services/
├── pipelineService.js
├── dashboardService.js
├── marketingService.js
└── permissionService.js
```

- Handlers become thin — **no deploy config change**

### Phase D — `database/` folder

- Move `supabase/` → `database/supabase/` OR symlink
- Update Supabase CLI config paths

### Phase E — `docker-compose` for dev

```yaml
services:
  redis:
    image: redis:7
  meilisearch:
    image: getmeili/meilisearch:v1.6
```

### Phase F — Terraform (optional)

```
infrastructure/terraform/
├── modules/
│   ├── vercel/
│   ├── railway/
│   └── supabase/
└── environments/
    ├── staging/
    └── production/
```

---

## 3. What NOT to do without approval

| Action | Risk |
|--------|------|
| Rename `frontend/` → breaks Vercel `buildCommand` | High |
| Move `api/index.js` | Breaks Vercel routing |
| Split into multiple repos | Loses atomic deploy |
| Introduce Next.js app | Blueprint violation |

---

## 4. Vercel compatibility note

Current `vercel.json`:

```json
"buildCommand": "cd frontend && npm run build",
"outputDirectory": "site"
```

Any restructure must preserve these paths **or** update Vercel project settings in same PR.

---

## 5. Recommended approval sequence

1. ✅ Approve documentation pack (`docs/*.md`)
2. ✅ Approve gap analysis + roadmap
3. ⬜ Approve Phase B (`packages/shared`)
4. ⬜ Approve Phase C (services extraction)
5. ⬜ Approve docker-compose dev stack
6. ⬜ Approve Terraform scope (if any)

---

## 6. Decision

| Option | Recommendation |
|--------|----------------|
| Full restructure now | ❌ Too risky |
| Evolutionary packages + services | ✅ Recommended |
| Greenfield `backend/` NestJS | ❌ Unless constitution overrides blueprint |

**Awaiting stakeholder approval before any folder moves.**
