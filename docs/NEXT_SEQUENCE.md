# Connect Intel — Next sequence (ops + product)

Operational playbook after landing + operator-access work (July 2026). Run steps **in order**.

---

## Phase 1 — Validate production

| Step | Command / action | Done when |
|------|------------------|-----------|
| 1.1 | `npm run prod:smoke` | Health, public-config, landing, dashboard shell OK |
| 1.2 | Manual: `docs/RELEASE_CHECKLIST.md` | Pipeline, auth, operator redirect, marketing mobile |
| 1.3 | Sign in as **Xindus manager** | Pipeline + Team work; no admin-home |
| 1.4 | Sign in as **platform operator** | Platform backend nav + customer ops |

---

## Phase 2 — Platform hardening (P0)

| Step | Command / action | Notes |
|------|------------------|-------|
| 2.1 | `npm run rbac:audit -- --strict` | CI already runs this; 0 mutation gaps |
| 2.2 | Confirm Supabase on Vercel | `USE_PIPELINE_LEADS_TABLE` + hierarchy RBAC auto-on when Supabase configured (`lib/server/infra/config.js`) |
| 2.3 | `npm run prod:ops -- --name=Xindus` | Meilisearch sync after deploy |
| 2.4 | `npm run prod:ops -- --data-sync --name=Xindus` | Pipeline + companies SQL backfill |
| 2.5 | `npm run pipeline:sync -- --name=Xindus` | SQL pipeline backfill if counts diverge |
| 2.6 | `npm run companies:sync -- --name=Xindus` | `pipeline_companies` verify + backfill |
| 2.6 | `npm run activities:backfill` | Activity log SQL (if hub enabled later) |
| 2.7 | `npm run constitution:ops` | Load gate + worker health |

---

## Phase 3 — Companies hub (product P0)

| Step | Action | Key files |
|------|--------|-----------|
| 3.1 | Run `companies:hierarchy-migrate` in Supabase if not applied | `supabase/migrations/` |
| 3.2 | Backfill companies from pipeline | `npm run companies:sync` |
| 3.3 | QA **Accounts** panel (company orgs) | `CompaniesPanel.jsx`, `companies-hub.js` |
| 3.4 | Link leads → `companyId` on save (verify) | `saved-leads.js` |
| 3.5 | Parent company hierarchy UI | Already in panel when `hierarchyEnabled` |

**Next build:** promote deal totals on account row; open account from pipeline company column.

---

## Phase 4 — Enable team analytics (when SQL trusted)

| Step | Action |
|------|--------|
| 4.1 | Flip `TEAM_INTELLIGENCE_IN_CRM_ENABLED` in `crmUiFlags.js` |
| 4.2 | Flip `ACTIVITY_LOG_HUB_IN_CRM_ENABLED` |
| 4.3 | Smoke rep review + **Last active (CRM)** uses `actor_id` only |
| 4.4 | `npm run dash:warm` |

---

## Phase 5 — GTM polish

| Step | Action |
|------|--------|
| 5.1 | Landing: real product screenshots (WebP) |
| 5.2 | Share `docs/CONNECT_INTEL_CRM_PRD.docx` with team |
| 5.3 | Chrome extension link in Team settings |

---

## Quick reference

```bash
npm run prod:ship          # before every push
npm run prod:smoke         # after live deploy
npm run prod:log           # mark LIVE + trigger ops
npm run prod:ops -- --name=Xindus
npm run rbac:audit -- --strict
npm run companies:sync
```

**Blueprint:** `docs/CRM_PLATFORM_BLUEPRINT.md`  
**PRD:** `docs/CONNECT_INTEL_CRM_PRD.docx`
