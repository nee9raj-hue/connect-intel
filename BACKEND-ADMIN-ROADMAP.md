# Connect Intel Backend and Admin Roadmap

This document translates the current prototype into a production path.

## Current state

The app now includes a Vercel serverless backend (sessions, SQLite store, admin imports, lead unlocks).

What exists now:

- Vite + React frontend (landing, auth, search, saved leads, admin panel)
- Cookie sessions via `api/auth/session.js`
- SQLite persistence in `lib/server/store.js` (local `data/`; `/tmp` on Vercel — not durable until Postgres)
- Search: imported DB → demo mock → Claude (`api/search-leads.js`, auth + quota required)
- Admin CSV/XLSX import (`api/admin/imports.js`) gated by `ADMIN_EMAILS`
- Trial credits and per-lead unlock (`api/lead-unlocks.js`)

What is still missing for production:

- Hosted Postgres (Supabase/Neon) instead of ephemeral `/tmp` on Vercel
- Payment gateway and plan upgrades
- Rate limiting and audit logs
- Apollo/Hunter as verified lead sources (not Claude-invented data)

## Important product note

The current `Claude` search is fine for demo UX, but it should not be the long-term source of leads.

For a real B2B product, the system must search against:

- imported exporter and shipping company data
- verified provider APIs
- enrichment pipelines
- internal normalized company/contact tables

AI should rank, summarize, classify, or enrich records. It should not invent the core lead database.

## Recommendation

Do not start with a full admin dashboard first.

Start with the backend foundation that makes admin useful:

1. database schema
2. server-side auth and roles
3. importer pipeline for exporter/shipping datasets
4. search API against stored records
5. admin UI on top of those APIs

That order avoids building an admin frontend with nowhere trustworthy to save data.

## Suggested stack

Keep the current frontend and add a lightweight backend layer first.

- Frontend: existing Vite + React app
- Hosting: Vercel is still fine for now
- Backend runtime: Vercel serverless routes initially
- Database: PostgreSQL via Supabase or Neon
- Auth: Google sign-in, but verified server-side
- File storage: Supabase Storage, S3, or Cloudflare R2 for CSV uploads
- Background jobs: start simple with import jobs processed server-side; move to queues later if needed

## Phase plan

### Phase 1: backend foundation

Goal: make users, roles, and data persistence real.

Build:

- `users`
- `organizations`
- `organization_memberships`
- `searches`
- `saved_leads`
- `import_jobs`

Server responsibilities:

- verify Google identity token
- create/update local user
- assign organization and role
- issue app session token or secure cookie
- persist searches and saved leads

### Phase 2: source-of-truth data model

Goal: store real companies and contacts, starting with India exporters and shipping ecosystem data.

Core tables:

- `companies`
- `contacts`
- `company_industries`
- `company_locations`
- `data_sources`
- `company_source_records`
- `contact_source_records`

Recommended company fields:

- legal_name
- display_name
- website
- country
- state
- city
- postal_code
- industry
- sub_industry
- company_type
- employee_range
- revenue_range
- exporter_flag
- shipping_flag
- source_confidence
- last_verified_at

Recommended contact fields:

- first_name
- last_name
- full_name
- title
- seniority
- email
- phone
- linkedin_url
- company_id
- source_confidence
- last_verified_at

### Phase 3: admin ingestion workflow

Goal: allow an admin to upload, validate, approve, and publish datasets.

Admin workflow:

1. upload CSV/XLSX
2. map columns
3. validate required fields
4. preview duplicates and conflicts
5. approve import
6. write normalized records
7. generate import report

Admin APIs:

- `POST /api/admin/imports`
- `POST /api/admin/imports/:id/preview`
- `POST /api/admin/imports/:id/commit`
- `GET /api/admin/imports`
- `GET /api/admin/imports/:id`
- `GET /api/admin/companies`
- `GET /api/admin/contacts`
- `PATCH /api/admin/companies/:id`
- `PATCH /api/admin/contacts/:id`

### Phase 4: real search backend

Goal: stop generating leads from Claude and search real records instead.

Search flow:

1. frontend sends filters
2. backend queries normalized company/contact records
3. backend applies permissions, quotas, and scoring
4. optional AI ranking enriches the result set
5. frontend receives real records with provenance

The current `api/search-leads.js` should evolve into:

- query builder for filters
- search pagination
- sorting by confidence, freshness, and relevance
- optional AI summary or lead scoring

### Phase 5: enrichment and provider integrations

Goal: improve accuracy and coverage once the internal data model exists.

Add later:

- Apollo
- Hunter
- Clearbit or alternatives
- shipping/export data sources
- CRM sync to HubSpot and Salesforce

These integrations should enrich your records, not define the app architecture.

## Recommended first admin scope

For this product, the first admin panel should not try to manage everything.

Start with:

- upload exporter company list
- upload shipping/logistics company list
- view import status
- inspect rejected rows
- search all imported companies
- manually edit company/contact fields

That is enough to prove the backend model and unlock useful search.

## Recommended first user-facing scope

After Phase 1 and Phase 2, update the current UI so that:

- Google sign-in creates a real app user
- searches are stored in the backend
- saved leads persist across sessions
- results come from backend company/contact data first
- Claude becomes an assistant for ranking and summarizing

## Minimal schema checklist

You do not need billing, CRM sync, and global multi-source enrichment on day one.

You do need:

- tenant-aware users
- admin role
- import job tracking
- normalized companies
- normalized contacts
- saved leads
- search history
- source provenance

## Immediate build order

This is the next implementation sequence I would follow in this repo:

1. Add backend project structure and shared config for server routes
2. Add database schema and migration files
3. Replace frontend-only auth state with backend-backed session flow
4. Persist saved leads and search history
5. Build admin import endpoints
6. Build admin UI for uploads and import monitoring
7. Replace Claude-generated search with database-backed search
8. Add AI scoring on top of stored results

## Suggested milestone definition

The first real milestone should be:

"An admin can upload exporter/shipping company data, the system stores it in a database, and a signed-in user can search and save those records from the current UI."

That milestone turns the project from demo to product foundation.

## Notes for this repo

Based on the current code:

- keep the current frontend and extend it
- keep Vercel routes short-term
- avoid investing further in frontend-only local state for saved leads and auth
- avoid using Claude to fabricate production leads
- design admin around data ingestion first, not around dashboard cosmetics

