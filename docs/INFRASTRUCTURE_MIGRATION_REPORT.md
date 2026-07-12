# Infrastructure Migration Report — Enterprise V2

**Date:** July 2026  
**Scope:** Platform kernel foundation (non-breaking)  
**Production impact:** None — adapters wrap existing implementations  
**Live users:** connectintel.net unchanged

---

## Executive summary

Connect Intel is evolving from a Vercel-centric serverless app into a **cloud-agnostic enterprise platform**. This delivery adds the **platform kernel** (`lib/platform/`), **Docker-based hosting**, **provider abstractions**, and **repository layer** — without rewriting business logic or breaking Xindus production.

The Constitution requirement to avoid vendor lock-in is addressed by **ports and adapters**: Supabase, Vercel, Railway, and Meilisearch remain today's default adapters, but new code can depend on interfaces only.

---

## What was built

### 1. Platform kernel (`lib/platform/`)

| Artifact | Purpose |
|----------|---------|
| `config/providers.js` | Resolves `DATABASE_PROVIDER`, `AUTH_PROVIDER`, etc. from env |
| `contracts/index.js` | Documents port shapes (database, auth, cache, email, search, storage, jobs, AI) |
| `adapters/*` | Swappable implementations wrapping **existing** server modules |
| `repositories/*` | Tenant-scoped Organization, Lead, Company, Pipeline repositories |
| `container.js` | `getPlatform()` dependency injection singleton |
| `platform.test.js` | Unit tests for config + repositories |

**Why:** Business logic should not import `supabaseRest`, `vercel`, or vendor SDKs. Repositories become the single data path; swapping Supabase → Neon → self-hosted Postgres becomes configuration.

### 2. Provider adapters (wrap, don't rewrite)

| Port | Default adapter | Wraps |
|------|-----------------|-------|
| Database | `supabase-rest` (prod) / `sqlite` (local) / `postgres` (Docker SQL) | `store.js`, `supabaseClient.js`, `pg` |
| Auth | `session-jwt` | `auth.js` |
| Cache | `memory-redis` | `infra/cache.js` |
| Email | `composite` | `emailProviders/index.js` |
| Search | `postgres` / `meilisearch` | `pipelineListLoad.js`, `meiliWarm.js` |
| Storage | `local` | Filesystem under `data/uploads/` |
| Jobs | `inline` / `bullmq` | `triggerDrain.js`, worker queues |
| AI | `gateway` | `gemini.js`, `perplexity.js` |

**Why:** Zero breaking changes. Production continues using Supabase REST + Vercel; local/Docker uses SQLite. Enterprise path enables `DATABASE_PROVIDER=postgres` on any host.

### 3. Docker + standalone server

| Artifact | Purpose |
|----------|---------|
| `docker-compose.yml` | One-command MVP (`npm run docker:up`) |
| `docker/Dockerfile.api` | Multi-stage build: frontend + API |
| `server/standalone.mjs` | Node HTTP server (no Vercel required) |
| `.env.docker.example` | Provider env template |

**Why:** Constitution requires `docker compose up` to start the platform. Supports Oracle Cloud Free, Railway, Hetzner, and local dev with **$0** infra (SQLite volume).

### 4. Observability hook

`GET /api/health` now includes `platform` object: contract version, resolved providers, database ping.

**Why:** Ops can verify provider resolution on any host without reading env manually.

### 5. Governance

| Artifact | Purpose |
|----------|---------|
| `docs/ENTERPRISE_INFRASTRUCTURE_V2.md` | Architecture reference |
| `.cursor/rules/enterprise-infrastructure-v2.mdc` | Permanent agent rules |
| `npm run platform:verify` | Pre-ship platform check |

---

## Architectural improvements

### Before

```
Handler → store.js / supabaseClient.js (direct)
Handler → gemini.js / perplexity.js (direct)
Vercel cron → maintenance
Vercel-only deploy
```

### After

```
Handler → getPlatform().repositories.* (new code path)
Handler → store.js (legacy — still works)
Platform → adapters → existing modules
Docker / Railway / Node → server/standalone.mjs
Jobs → platform.jobs (inline | bullmq)
AI → platform.ai gateway
```

---

## How this supports the long-term vision

| Future module | Plugs into |
|---------------|------------|
| Voice AI, WhatsApp | `platform.jobs` + messaging providers |
| Market / Company Intelligence | `platform.ai` + `repositories/companies` |
| Workflow engine | `platform.jobs` + event bus (next phase) |
| Mobile apps | `API_BASE_URL` + same repositories |
| Enterprise SSO (SAML, Okta) | `AUTH_PROVIDER` adapter |
| Vector search (Qdrant, Pinecone) | `SEARCH_PROVIDER` adapter |
| S3 / R2 file storage | `STORAGE_PROVIDER` adapter |
| Kubernetes workers | `JOBS_PROVIDER=bullmq` + same Docker image |

---

## Multi-tenancy preserved

- `repositories/base.js` enforces `organizationId` scoping helpers
- Existing `permissionEnforce.js`, `pipelineTableScope.js`, RBAC unchanged
- No repository method returns cross-org data by design

---

## $0 MVP path (Constitution compliant)

```
Developer laptop / Oracle Free VM
  → docker compose up
  → SQLite document store (volume)
  → inline jobs (browser drain for email)
  → postgres FTS search (no Meili required)
  → optional: --profile postgres for SQL migrations
```

**Not optimized for "free forever"** — optimized for **replaceable infra at minimum cost** until revenue supports Pro tiers.

---

## What was NOT changed (intentionally)

- No handler rewrites (no regression risk for Xindus)
- No removal of Supabase or Vercel from production
- No TypeScript migration (documented as future P1 in gap analysis)
- No `/api/v1` versioning yet
- No Prisma ORM (Postgres via `pg` pool in postgres adapter)

---

## Recommended next steps (priority order)

1. ~~**Migrate `companies-hub` handler** to `platform.repositories.companies`~~ **Done (Jul 2026)**
2. ~~**Migrate `saved-leads` GET list** to `platform.repositories.pipeline.loadListPage`~~ **Done (Jul 2026)**
3. ~~**Migrate board/deals/summary GET** in `saved-leads` to pipeline repository~~ **Done (Jul 2026)**
4. **Postgres document store migration** — move `store_collections` off Supabase REST (P2)
5. **Hobby-safe `vercel.json`** if downgrading Vercel plan (see prior analysis)
6. **Auth provider** — SAML stub behind `AUTH_PROVIDER=azure-ad`
7. **S3 storage adapter** for workspace uploads
8. ~~**CI gate:** `npm run platform:verify` in GitHub Actions~~ **Done (Jul 2026)**

---

## Additional recommendation (enterprise-clean codebase)

Keep the codebase **enterprise-clean**, not **MVP-clean**:

- Prefer **clear module boundaries** over shortcuts in new PRs
- **Never** add new `supabaseRest()` calls in handlers — extend repositories
- **Document** each new adapter in `ENTERPRISE_INFRASTRUCTURE_V2.md`
- **Evolve schema** only via `supabase/migrations/` — no ad hoc JSON shape changes
- **Interfaces** for AI, email, storage, auth, search — already in platform kernel

This costs almost nothing today and makes migration to paid infrastructure (or self-hosted Oracle/Hetzner) a **configuration change**, not a rewrite.

---

## Verification

```bash
npm run platform:verify   # Provider resolution + DB ping
npm run test              # Includes lib/platform/platform.test.js
npm run docker:up         # Optional full stack smoke
npm run prod:ship         # Before production push
```

---

## Files added (reference)

```
lib/platform/
server/standalone.mjs
docker-compose.yml
docker/Dockerfile.api
docker/init-db.sql
.env.docker.example
scripts/platform-verify.mjs
docs/ENTERPRISE_INFRASTRUCTURE_V2.md
docs/INFRASTRUCTURE_MIGRATION_REPORT.md
.cursor/rules/enterprise-infrastructure-v2.mdc
```

**Modified:** `lib/server/handlers/health.js`, `lib/server/gemini.js` (export `generateText`), `package.json`
