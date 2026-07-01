# Connect Intel

**Enterprise CRM & revenue platform** — pipeline, marketing automation, AI prospecting, and team collaboration.

**Live:** [connectintel.net](https://connectintel.net)

---

## What this is

Connect Intel helps B2B teams find leads, work a sales pipeline, run email campaigns, and collaborate in one workspace. It supports **company organizations** (multi-user, RBAC) and **individual** sellers.

---

## Documentation (start here)

| Document | Description |
|----------|-------------|
| [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) | System design, current vs target architecture |
| [**CRM_GAP_ANALYSIS.md**](docs/CRM_GAP_ANALYSIS.md) | Constitution vs as-built gaps |
| [**PROJECT_ROADMAP.md**](docs/PROJECT_ROADMAP.md) | 25-phase delivery plan |
| [**CRM_PLATFORM_BLUEPRINT.md**](docs/CRM_PLATFORM_BLUEPRINT.md) | Product evolution (extend-in-place) |
| [**DATABASE.md**](docs/DATABASE.md) | JSON store + PostgreSQL schema |
| [**API.md**](docs/API.md) | API conventions and route groups |
| [**SECURITY.md**](docs/SECURITY.md) | Auth, RBAC, tenancy |
| [**CODING_STANDARDS.md**](docs/CODING_STANDARDS.md) | How we write code |
| [**DEPLOYMENT.md**](docs/DEPLOYMENT.md) | Production deploy & rollback |

**Full index:** `docs/` folder (30+ runbooks)

---

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | Vite 8, React 19, Tailwind 4, JavaScript |
| API | Node 22, Vercel serverless (`api/index.js`) |
| Data | Supabase (JSON collections + PostgreSQL) |
| Queue | BullMQ on Railway, SQL marketing queue |
| Email | Resend, Gmail OAuth, SendGrid adapter |

---

## Development

```bash
npm run dev          # Frontend at http://localhost:5173
npx vercel dev       # API + frontend (requires Vercel CLI)
npm run prod:ship    # Production build + checks
npm run prod:preview # Preview production build locally
```

---

## Production

```bash
npm run prod:ship    # Before every push to main
git push origin main
npm run prod:log     # After Vercel deploy — updates PRODUCTION_LOG.md
```

Rollback: `npm run prod:rollback -- <commit>` — see [`docs/PRODUCTION_LOG.md`](docs/PRODUCTION_LOG.md)

---

## Architecture governance

This project follows the **Enterprise CRM Engineering Constitution** with an approved **extend-in-place** blueprint. New implementation work requires:

1. Completed gap analysis ✅
2. Approved roadmap ⬜
3. Approved repository changes ⬜

**Do not start constitution-mandated rewrites (Next.js, Prisma-only, etc.) without explicit approval.**

---

## Repository layout

```
api/              Vercel serverless router
lib/server/       Backend domain + handlers
frontend/         React SPA source
supabase/         SQL migrations
workers/          Railway BullMQ workers
scripts/          Deploy, backfill, ops
docs/             Architecture & runbooks
site/             Production static build
```

See [`docs/REPOSITORY_STRUCTURE_PROPOSAL.md`](docs/REPOSITORY_STRUCTURE_PROPOSAL.md) for future structure.

---

## License & support

Proprietary — Connect Intel. For production issues, use `PRODUCTION_LOG.md` rollback and `RELEASE_CHECKLIST.md`.
