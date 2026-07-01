# Connect Intel — Deployment

**Last updated:** 2026-06-24

> **Also see:** Root [`DEPLOYMENT.md`](../DEPLOYMENT.md) for beginner hosting guide.

---

## 1. Production topology

| Component | Provider | URL / service |
|-----------|----------|---------------|
| Web + API | Vercel | https://connectintel.net |
| Static build | `site/` from `frontend/` Vite build | |
| API router | `api/index.js` serverless | `maxDuration: 300s` |
| Workers | Railway | BullMQ consumers (`workers/index.mjs`) |
| Database | Supabase | Postgres + `store_collections` |
| Cache / queue | Upstash Redis | Optional but recommended |
| Error tracking | Sentry | `@sentry/node` |

---

## 2. Deploy workflow

### Pre-push (required)

```bash
npm run prod:ship
```

Runs: frontend build, handler import checks, missing file validation.

### Push

```bash
git push origin main
```

GitHub Actions CI mirrors build (`/.github/workflows/ci.yml`).

### Post-deploy

```bash
npm run prod:log          # Sync PRODUCTION_LOG.md
# Verify LIVE commit in docs/PRODUCTION_LOG.md
npm run prod:tag -- <sha> # Optional known-good tag
```

### Rollback

```bash
npm run prod:rollback -- <commit>
```

Commits listed in `docs/PRODUCTION_LOG.md`.

---

## 3. Environment variables

See `PLATFORM_HARDENING.md` and `INFRA_SETUP.md` for full lists.

| Category | Examples |
|----------|----------|
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Auth | `SESSION_SECRET`, Google OAuth client |
| Email | `RESEND_API_KEY` |
| Redis | `REDIS_URL` |
| Cron | `CRON_SECRET` |
| Feature flags | `USE_PIPELINE_LEADS_TABLE`, `USE_MARKETING_SQL_QUEUE` |
| AI | OpenAI / compatible API keys |
| Sentry | `SENTRY_DSN` |

**Never commit secrets.** Vercel + Railway env dashboards are source of truth.

---

## 4. Vercel configuration

**File:** `vercel.json`

- API rewrite: `/api/(.*)` → `/api?path=$1`
- SPA fallback to `index.html`
- Cache headers for assets vs `index.html`
- **Cron:** `crm/dashboard-warm-cron` at 04:00 UTC

**Hobby plan limit:** 1 cron job — marketing cron runs via external scheduler or manual trigger (`CRON_AUDIT.md`).

---

## 5. Railway worker

**File:** `railway.toml`  
**Start:** `npm run workers`

Processes BullMQ queues: email, automation, import, export, analytics, notification, search-index.

**Doc:** `RAILWAY_WORKER.md`

---

## 6. Database migrations

1. Apply SQL in `supabase/migrations/` via Supabase CLI or dashboard
2. Run backfills: `npm run pipeline:backfill`, `npm run enterprise:backfill`
3. Enable feature flags in Vercel env
4. Smoke test per `RELEASE_CHECKLIST.md`

---

## 7. Manual operations

| Script | Purpose |
|--------|---------|
| `npm run dash:warm` | Warm dashboard snapshots |
| `scripts/marketing-queue-worker.mjs` | Drain SQL email queue |
| `npm run prod:preview` | Local production build preview |

---

## 8. Constitution gaps (infrastructure)

| Item | Status |
|------|--------|
| Terraform / IaC | ❌ |
| Kubernetes | ❌ |
| Docker Compose dev stack | ❌ |
| Blue-green deploy | Vercel instant rollback only |
| Automated E2E post-deploy | ❌ |

---

## 9. Release checklist

Full manual smoke items: `RELEASE_CHECKLIST.md`

Minimum before user-facing ship:
- [ ] `prod:ship` passes
- [ ] CI green
- [ ] `prod:log` shows correct LIVE commit
- [ ] Login + pipeline save + dashboard load on production

---

## 10. Related

| Doc | Topic |
|-----|-------|
| `PRODUCTION_LOG.md` | Deploy history |
| `PLATFORM_HARDENING.md` | One-shot prod setup |
| `CRON_AUDIT.md` | Scheduled jobs |
| `ENTERPRISE_SCALABILITY.md` | Scale patterns |
