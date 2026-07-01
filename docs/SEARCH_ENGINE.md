# Connect Intel — Search Engine

**Last updated:** 2026-06-24

---

## 1. Overview

Search spans **in-app navigation**, **record lookup**, **AI prospecting**, and optional **Meilisearch** full-text indexing.

---

## 2. Search surfaces

| Surface | Entry | Backend |
|---------|-------|---------|
| Command palette ⌘K | `CommandPalette.jsx` | `platform/search` |
| AI prospecting | `PeopleSearch` panel | `search-leads` |
| Pipeline filter | Client + server filters | `saved-leads?q=` |
| Contacts / companies | Panel search boxes | `contacts`, `companies/hub` |
| Search history | User history UI | `search-history` |

---

## 3. Platform search (`/api/platform/search`)

**Handler:** `lib/server/handlers/platform-search.js`

Searches across:
- Pipeline leads (name, company, email)
- Nav targets (client-side merge)
- Team members

Used by command palette for quick navigation + record jump.

---

## 4. AI prospecting (`/api/search-leads`)

**Handler:** `lib/server/handlers/search-leads.js`

- Live AI web search for companies/contacts by natural language query
- Requires server-side AI keys
- Results importable to pipeline / admin master DB
- History stored in `searches` collection

**Product flags:** `crmProductFlags.js` — can hide AI search for specific go-lives.

---

## 5. Meilisearch (optional)

**Path:** `lib/server/meilisearch/`

- Index pipeline leads for sub-100ms full-text (target)
- Queue: `ci-search-index` BullMQ job
- **Status:** Integration partial; requires `MEILISEARCH_*` env (`INFRA_SETUP.md`)

---

## 6. Client-side filtering

| Module | Purpose |
|--------|---------|
| `pipelineFilters.js` | Pipeline list/board filters |
| `pipelineDealsFilter.js` | Deals view filters |
| `navConfig.js` | Pipeline sidebar counts |

Heavy filtering prefers **server-side** when `pipeline_leads` SQL active.

---

## 7. Constitution gaps

| Requirement | Status |
|-------------|--------|
| Enterprise search at millions of records | Partial — SQL path helps |
| Unified search index | Meilisearch not default |
| Search analytics | ❌ |
| Per-org index isolation | Planned via `org_id` filter |

---

## 8. Configuration

| Env var | Purpose |
|---------|---------|
| `MEILISEARCH_HOST` | Meilisearch URL |
| `MEILISEARCH_API_KEY` | API key |
| AI provider keys | `search-leads` |

---

## 9. Roadmap

See `PROJECT_ROADMAP.md` Phase 19:
- Production Meilisearch with org-scoped indexes
- Index on pipeline write (event-driven)
- Search ranking tuning + analytics
