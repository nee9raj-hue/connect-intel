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
| `AUTH_PROVIDER` | `session-jwt`, `google-oauth`, `azure-ad`, `okta`, `saml` | `session-jwt` | same |
| `EMAIL_PROVIDER` | `composite`, `smtp`, `resend`, `gmail`, `ses` | `composite` | same |
| `SEARCH_PROVIDER` | `postgres`, `meilisearch`, `none` | meili if configured | `postgres` |
| `STORAGE_PROVIDER` | `local`, `s3`, `r2`, `minio` | `local` | `local` |
| `AI_PROVIDER` | `gateway`, `gemini`, … | `gateway` | `gateway` |
| `CACHE_PROVIDER` | `memory`, `memory-redis`, `redis` | memory-redis if Redis | `memory` |
| `JOBS_PROVIDER` | `inline`, `bullmq`, `manual` | bullmq if Redis | `inline` |
| `HOST_PROVIDER` | `vercel`, `docker`, `railway`, `node` | auto-detect | `docker` |
| `STORE_BACKEND` | `postgres`, `supabase-rest`, `sqlite` | follows `DATABASE_PROVIDER` / Supabase env | `sqlite` |

---

## 4. Repositories (initial)

| Repository | Methods | Notes |
|------------|---------|-------|
| `organizations` | `findById`, `listForUser`, `listMembers` | Org isolation |
| `leads` | `findById`, `listForOrg`, `countForOrg` | Pipeline entries |
| `companies` | `listHub`, `getDetail`, `updateParent`, `listForOrg`, `findById` | Accounts hub (SQL + in-memory) |
| `pipeline` | `loadListPage`, `loadLeadsByIds`, `loadSummaryOnly`, `loadBoardView`, `loadDealsPage`, `loadSummaryWithDeals`, `resolveListSource`, `readShardEntries`, `summaryForOrg`, `verifySqlBackfill` | All pipeline GET reads |

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

### Postgres document store (P2)

```bash
# Docker with Postgres document store (no Supabase REST for JSON collections)
npm run docker:postgres

# Or set on any host with Postgres:
#   DATABASE_PROVIDER=postgres
#   STORE_BACKEND=postgres
#   DATABASE_URL=postgresql://...
```

Production **connectintel.net** stays on `supabase-rest` until you explicitly set `STORE_BACKEND=postgres` on Vercel (same `store_collections` table, direct `pg` pool).

---

## 6. Zero-cost MVP deployment targets

| Target | Stack | Cost |
|--------|-------|------|
| **Local Docker** | `docker compose` + SQLite volume | $0 |
| **Oracle Cloud Free VM** | Docker on ARM VM + SQLite/Postgres | $0 |
| **Railway** | Dockerfile.api + volume | $0 credits, then usage |
| **Cloudflare Pages** | Static only — **needs** separate API host | $0 static |
| **Vercel Hobby** | Current production path | $0 (limits apply) |

**Production today (connectintel.net):** Vercel + Supabase + Railway workers — unchanged. Adapters wrap existing code.

### Hosting decision tree

| Question | Answer |
|----------|--------|
| **Where is production now?** | Vercel (web + API) + Supabase + Railway (workers, Meilisearch) |
| **Need Cloudflare today?** | **No** — not required for current blueprint path |
| **$0 MVP / dev escape hatch?** | `npm run docker:up` locally, or Oracle Cloud Free VM + same Docker image |
| **When to add Cloudflare?** | Only when splitting static (Pages) from API, or adopting R2 (`STORAGE_PROVIDER=r2`) in P4 |
| **When to leave Vercel?** | Hobby limits, cost, or enterprise self-host — migrate via `HOST_PROVIDER=docker` + Postgres, not a rewrite |

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

## 9. Enterprise auth (P3)

All providers issue the same **session JWT** after login — handlers keep using `requireUser` / cookies.

| Provider | Env | Login path |
|----------|-----|------------|
| `session-jwt` | default | Google credential + email/password (`/api/auth/session`) |
| `azure-ad` | `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET` | `/api/auth/sso/start?provider=azure-ad` |
| `okta` | `OKTA_DOMAIN`, `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET` | `/api/auth/sso/start?provider=okta` |
| `saml` | `SAML_SP_ENTITY_ID`, `SAML_IDP_SSO_URL`, `SAML_IDP_CERT_PEM` | Stub — full assertion parsing in follow-up |

Redirect URI for OIDC (register in IdP): `https://<your-domain>/api/auth/sso/callback`

`/api/public-config` includes `auth.enterprise[]` with `configured` + `startUrl` for the frontend.

Production **unchanged** until `AUTH_PROVIDER=azure-ad` (or Okta) and IdP env vars are set.

---

## 10. Migration strategy (non-breaking)

| Phase | Work | Status |
|-------|------|--------|
| **P0** | Platform kernel + Docker + docs | **Done** |
| **P1** | Migrate handlers → repositories (pipeline, companies) | **Done** |
| **P2** | Postgres document store (`store_collections` via `pg`, not PostgREST) | **Done (opt-in)** — set `DATABASE_PROVIDER=postgres` + `STORE_BACKEND=postgres` |
| **P3** | Auth abstraction (SAML/Azure AD/Okta) behind `AUTH_PROVIDER` | **Done (opt-in)** — OIDC SSO + session JWT; SAML env stub |
| **P4** | Storage S3/R2 adapter | Planned |
| **P5** | Full OpenAPI `/api/v1` | Planned |

---

## 11. Verify

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
