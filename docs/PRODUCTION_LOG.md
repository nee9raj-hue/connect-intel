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
npm run prod:rollback -- 3fcb997
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
| Commit | `a051761` |
| Log updated (IST) | 02/07/2026, 09:43:57 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 02/07/2026, 09:43:45 | `a051761` | Fix marketing hub access for sales reps and org members on core CRM. | [preview](https://connect-intel-cmb7vlnp5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a051761` | **← LIVE**
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
| 02/07/2026, 00:26:00 | `9a95c23` | Update production log for Deploy 3 (94619ac). | [preview](https://connect-intel-2q59ow73u-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9a95c23` |
| 02/07/2026, 00:24:56 | `94619ac` | Ship Deploy 3: unified workflow engine, audit stream, and OpenAPI registry. | [preview](https://connect-intel-rc3p3k61c-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 94619ac` |
| 02/07/2026, 00:19:19 | `ad01db2` | Ship P0 pipeline: table-first PATCH, targeted shard reads, and pipeline-sync ops. | [preview](https://connect-intel-1fv0hor8i-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ad01db2` |
| 02/07/2026, 00:14:26 | `6a81c44` | Ship Phase 4: profile SQL sync on all membership paths and lazy repair. | [preview](https://connect-intel-rjdjo2242-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6a81c44` |
| 01/07/2026, 23:57:01 | `1cbfe58` | Ship Phase 3+ SQL UUID resolution, legacy org backfill, and lazy repair. | [preview](https://connect-intel-9gpdc7a8a-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1cbfe58` |
| 01/07/2026, 23:52:30 | `f333c3d` | Ship Phase 3 org SQL sync for onboarding, invites, and tenant guards. | [preview](https://connect-intel-4clvah8g7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f333c3d` |
| 01/07/2026, 23:46:02 | `b905e10` | Ship Phase 2: server dashboard layouts, CRM workflow bridge, and auth tests. | [preview](https://connect-intel-n4kytyow6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b905e10` |

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
