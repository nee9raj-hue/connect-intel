# Connect Intel — Enterprise Infrastructure V2

**Status:** Foundation shipped (platform kernel + Docker + provider abstractions)  
**Constitution:** Enterprise CRM AI Engineering Constitution + `docs/CRM_PLATFORM_BLUEPRINT.md`  
**Goal:** Cloud-agnostic, modular, $0 MVP-capable, no vendor lock-in — **without** breaking live CRM users.

---

## 1. Architecture layers

```
┌─────────────────────────────────────────────────────────┐
│  Presentation — Vite/React (frontend/)                │
│  API_BASE_URL / relative /api only                     │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  API Layer — lib/server/handlers/* (thin HTTP)          │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Business Layer — domain modules (pipeline, marketing…)   │
│  (gradual migration → use getPlatform())                │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Platform Kernel — lib/platform/                        │
│  Repositories · Provider adapters · DI container        │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Infrastructure — Postgres, Redis, Meili, SMTP, LLM APIs  │
│  Selected by env — swappable without code changes       │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Platform kernel (`lib/platform/`)

| Component | Path | Purpose |
|-----------|------|---------|
| Provider config | `config/providers.js` | Resolves `*_PROVIDER` env vars |
| Contracts | `contracts/index.js` | Port interfaces (database, auth, …) |
| Adapters | `adapters/*` | Vendor implementations |
| Repositories | `repositories/*` | Tenant-scoped data access |
| Container | `container.js` | `getPlatform()` singleton |

### Usage in new code

```javascript
import { getPlatform } from '../../platform/index.js'

const platform = getPlatform()
const org = await platform.repositories.organizations.findById(orgId)
await platform.jobs.runNow('data-sync', { orgId })
```

### Health

`GET /api/health` includes `platform` block with provider resolution and DB ping.

---

## 3. Provider matrix

| Env var | Values | Default (auto) | MVP $0 |
|---------|--------|----------------|--------|
| `DATABASE_PROVIDER` | `postgres`, `supabase-rest`, `sqlite` | supabase-rest if Supabase env; else sqlite | `sqlite` |
| `AUTH_PROVIDER` | `session-jwt`, `google-oauth` | `session-jwt` | same |
| `EMAIL_PROVIDER` | `composite`, `smtp`, `resend`, `gmail`, `ses` | `composite` | same |
| `SEARCH_PROVIDER` | `postgres`, `meilisearch`, `none` | meili if configured | `postgres` |
| `STORAGE_PROVIDER` | `local`, `s3`, `r2`, `minio` | `local` | `local` |
| `AI_PROVIDER` | `gateway`, `gemini`, … | `gateway` | `gateway` |
| `CACHE_PROVIDER` | `memory`, `memory-redis`, `redis` | memory-redis if Redis | `memory` |
| `JOBS_PROVIDER` | `inline`, `bullmq`, `manual` | bullmq if Redis | `inline` |
| `HOST_PROVIDER` | `vercel`, `docker`, `railway`, `node` | auto-detect | `docker` |

---

## 4. Repositories (initial)

| Repository | Methods | Notes |
|------------|---------|-------|
| `organizations` | `findById`, `listForUser`, `listMembers` | Org isolation |
| `leads` | `findById`, `listForOrg`, `countForOrg` | Pipeline entries |
| `companies` | `listHub`, `getDetail`, `updateParent`, `listForOrg`, `findById` | Accounts hub (SQL + in-memory) |
| `pipeline` | `readShardEntries`, `loadListPage`, `summaryForOrg`, `verifySqlBackfill` | SQL verify + list read port |

**Rule:** New features use repositories. Legacy handlers keep working via `store.js` until migrated.

---

## 5. Docker (one command)

```bash
cp .env.docker.example .env.docker   # optional — set Google OAuth for sign-in
npm run docker:up                    # docker compose up --build
open http://localhost:3000
```

| Service | Profile | Purpose |
|---------|---------|---------|
| `api` | default | Frontend + API (`server/standalone.mjs`) |
| `postgres` | `postgres` | Optional SQL migrations dev |
| `worker` | `worker` | Optional BullMQ worker |

Data persists in Docker volume `appdata` (`CONNECT_INTEL_DATA_DIR=/app/data`).

### Standalone (no Docker)

```bash
npm run build
npm run server
```

---

## 6. Zero-cost MVP deployment targets

| Target | Stack | Cost |
|--------|-------|------|
| **Local Docker** | `docker compose` + SQLite volume | $0 |
| **Oracle Cloud Free VM** | Docker on ARM VM + SQLite/Postgres | $0 |
| **Railway** | Dockerfile.api + volume | $0 credits, then usage |
| **Cloudflare Pages** | Static only — **needs** separate API host | $0 static |
| **Vercel Hobby** | Current production path | $0 (limits apply) |

**Production today (connectintel.net):** Vercel + Supabase — unchanged. Adapters wrap existing code.

---

## 7. Background jobs (no Vercel cron lock-in)

| Mode | Provider | When |
|------|----------|------|
| Browser drain | `inline` | MVP / Hobby — user initiates sends |
| Fire-and-forget HTTP | `inline` + `triggerQueueDrainNow` | After Redis enqueue |
| BullMQ worker | `bullmq` | Railway/Docker worker profile |
| Manual ops | `npm run prod:ops` | Post-deploy |

`platform.jobs.runNow('meili-sync' | 'data-sync', { orgId })` for ops scripts.

---

## 8. AI gateway

All new Copilot / enrichment features call:

```javascript
await platform.ai.run('web_research', { query })
await platform.ai.run('parse_search_query', { query, existingFilters })
```

Providers (Gemini, Perplexity, future OpenAI/Anthropic/local LLM) live inside `adapters/ai/`.

---

## 9. Migration strategy (non-breaking)

| Phase | Work | Status |
|-------|------|--------|
| **P0** | Platform kernel + Docker + docs | **Done** |
| **P1** | Migrate handlers → repositories (pipeline, companies) | **In progress** — `companies-hub` on `platform.repositories.companies`; pipeline `loadListPage` port ready |
| **P2** | `DATABASE_PROVIDER=postgres` on self-hosted; deprecate supabase-rest | Planned |
| **P3** | Auth abstraction (SAML/Azure AD) behind `AUTH_PROVIDER` | Planned |
| **P4** | Storage S3/R2 adapter | Planned |
| **P5** | Full OpenAPI `/api/v1` | Planned |

---

## 10. Verify

```bash
npm run platform:verify
npm run test
npm run prod:ship
```

---

## Related docs

- `docs/INFRASTRUCTURE_MIGRATION_REPORT.md` — what changed and why
- `docs/CRM_PLATFORM_BLUEPRINT.md` — product architecture
- `docs/CRON_AUDIT.md` — job scheduling without Vercel lock-in
- `.cursor/rules/enterprise-infrastructure-v2.mdc` — agent rules
