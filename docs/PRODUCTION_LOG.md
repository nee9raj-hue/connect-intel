# Production deployment log

Connect Intel production runs on **Vercel** at [connectintel.net](https://connectintel.net).

This file is the human-readable view of `docs/production-log.json`. After each production deploy, run:

```bash
npm run prod:log
```

That syncs Vercel deployments with git commits so you can **roll back** to any known good snapshot without guessing.

---

## Quick rollback

1. Find the row you want below (date/time + commit message).
2. Run the rollback command for that commit, for example:

```bash
npm run prod:rollback -- bd8eb2e
```

3. Wait until Vercel finishes (~30s). **connectintel.net** will serve that older build immediately.
4. Fix code on `main`, test locally, then deploy again when ready.

**Preview before rollback:** open the **preview** link in the table — that URL is the exact build for that commit (still hosted on Vercel).

**Dashboard:** [Vercel → connect-intel → Deployments](https://vercel.com/nee9raj-hues-projects/connect-intel)

---

## Current production

| Field | Value |
|-------|-------|
| Domain | https://connectintel.net |
| Commit | `318efc2` |
| Log updated (IST) | 02/07/2026, 17:27:35 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 02/07/2026, 17:24:56 | `318efc2` | Fix Meili sync cron import and improve prod:ops HTTP trigger. | [preview](https://connect-intel-ldzna043q-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 318efc2` | **← LIVE**
| 02/07/2026, 10:32:53 | `bd8eb2e` | Add automated production Meilisearch sync via Vercel cron and prod:ops. | [preview](https://connect-intel-iiaha1cz7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bd8eb2e` |
| 02/07/2026, 10:18:32 | `b199074` | Ship Deploy 10: expand Meilisearch to contacts, companies, and deals. | [preview](https://connect-intel-jpp7eio01-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b199074` |
| 02/07/2026, 10:04:31 | `b01563d` | Ship Deploy 9: pipeline and marketing snapshot materialization. | [preview](https://connect-intel-9inhrn9it-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b01563d` |
| 02/07/2026, 09:59:09 | `f69515d` | Ship Deploy 8: table-first PATCH, search, notifications, and RBAC hardening. | [preview](https://connect-intel-d9iu760n0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f69515d` |
| 02/07/2026, 09:49:14 | `02163af` | Fix manual lead add for orgs with no existing pipeline shard. | [preview](https://connect-intel-omtvcqjn5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 02163af` |
| 02/07/2026, 09:44:26 | `3ff2bb6` | Update production log for marketing RBAC fix (a051761). | [preview](https://connect-intel-luxxma4ft-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3ff2bb6` |
| 02/07/2026, 09:43:45 | `a051761` | Fix marketing hub access for sales reps and org members on core CRM. | [preview](https://connect-intel-cmb7vlnp5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a051761` |
| 02/07/2026, 09:40:34 | `3fcb997` | Update production log for lean CRM trim (0e69a91). | [preview](https://connect-intel-qyhuzs66e-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3fcb997` |
| 02/07/2026, 09:39:44 | `0e69a91` | Hide team intelligence and activity log hubs for lean core CRM. | [preview](https://connect-intel-202fa2129-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0e69a91` |
| 02/07/2026, 09:26:35 | `8e03ec2` | Update production log for Deploy 7 (36b403d). | [preview](https://connect-intel-p8nityw2v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8e03ec2` |
| 02/07/2026, 09:13:01 | `36b403d` | Ship Deploy 7: Meilisearch sync on save, SQL-aware backfill, and meili-sync ops. | [preview](https://connect-intel-7evfeqmm0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 36b403d` |
| 02/07/2026, 00:59:40 | `97b5263` | Update production log for Deploy 6 (3be6c3a). | [preview](https://connect-intel-ddnac0gun-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 97b5263` |
| 02/07/2026, 00:58:55 | `3be6c3a` | Ship Deploy 6: SQL companies table, sync/backfill, and Accounts hub reads. | [preview](https://connect-intel-btng3k6i8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3be6c3a` |
| 02/07/2026, 00:53:13 | `c235302` | Add production schema repair migration and harden crm_relational_v3. | [preview](https://connect-intel-fjemwvy51-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c235302` |
| 02/07/2026, 00:44:15 | `2c536af` | Update production log for Deploy 5 (64d9197). | [preview](https://connect-intel-40q2c1lx2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2c536af` |
| 02/07/2026, 00:43:30 | `64d9197` | Ship Deploy 5: SQL deals table, sync/backfill, and indexed lead timeline. | [preview](https://connect-intel-to9ynd3fp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 64d9197` |
| 02/07/2026, 00:36:56 | `7c84a1e` | Update production log for Deploy 4 (135b030). | [preview](https://connect-intel-3oqbgncoh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7c84a1e` |
| 02/07/2026, 00:36:03 | `135b030` | Ship Deploy 4: workflow runs, inactivity triggers, and audit log UI. | [preview](https://connect-intel-5t99whwwl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 135b030` |

---

## After a bad deploy

1. **Rollback first** — restore the site for users (`npm run prod:rollback -- <commit>`).
2. Add a note in `docs/production-log.json` on that entry's `notes` field (optional), e.g. `"Known good baseline before marketing UI change"`.
3. Run `npm run prod:log` again to refresh this table.
4. Fix forward on a new commit; do not force-push `main` unless you know what you are doing.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run prod:log` | Sync log from Vercel + regenerate this file |
| `npm run prod:log:list` | Print snapshots in the terminal |
| `npm run prod:rollback -- <commit>` | Point production domain at that deployment |
| `npm run prod:ship` | Pre-flight checks before pushing to `main` |
| `npm run prod:verify` | Build + verify critical files only |
| `npm run prod:tag -- [commit]` | Git tag for a known-good production commit |

---

*Auto-generated by `scripts/production-log.mjs markdown`. Edit notes in `docs/production-log.json` only.*
