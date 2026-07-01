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
npm run prod:rollback -- 9a95c23
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
| Commit | `135b030` |
| Log updated (IST) | 02/07/2026, 00:36:13 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 02/07/2026, 00:36:03 | `135b030` | Ship Deploy 4: workflow runs, inactivity triggers, and audit log UI. | [preview](https://connect-intel-5t99whwwl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 135b030` | **← LIVE**
| 02/07/2026, 00:26:00 | `9a95c23` | Update production log for Deploy 3 (94619ac). | [preview](https://connect-intel-2q59ow73u-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9a95c23` |
| 02/07/2026, 00:24:56 | `94619ac` | Ship Deploy 3: unified workflow engine, audit stream, and OpenAPI registry. | [preview](https://connect-intel-rc3p3k61c-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 94619ac` |
| 02/07/2026, 00:19:19 | `ad01db2` | Ship P0 pipeline: table-first PATCH, targeted shard reads, and pipeline-sync ops. | [preview](https://connect-intel-1fv0hor8i-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ad01db2` |
| 02/07/2026, 00:14:26 | `6a81c44` | Ship Phase 4: profile SQL sync on all membership paths and lazy repair. | [preview](https://connect-intel-rjdjo2242-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6a81c44` |
| 01/07/2026, 23:57:01 | `1cbfe58` | Ship Phase 3+ SQL UUID resolution, legacy org backfill, and lazy repair. | [preview](https://connect-intel-9gpdc7a8a-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1cbfe58` |
| 01/07/2026, 23:52:30 | `f333c3d` | Ship Phase 3 org SQL sync for onboarding, invites, and tenant guards. | [preview](https://connect-intel-4clvah8g7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f333c3d` |
| 01/07/2026, 23:46:02 | `b905e10` | Ship Phase 2: server dashboard layouts, CRM workflow bridge, and auth tests. | [preview](https://connect-intel-n4kytyow6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b905e10` |
| 01/07/2026, 23:38:51 | `2f563f0` | Close RBAC audit gaps with matrix gates and strict CI enforcement. | [preview](https://connect-intel-mha6tjqyh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2f563f0` |
| 01/07/2026, 23:28:33 | `49da0b7` | Ship Phase 1 foundation: CI tests, RBAC gates, and dashboard SSE pulse. | [preview](https://connect-intel-ap2to6fzx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 49da0b7` |
| 01/07/2026, 23:23:45 | `dc4d264` | Update production log after architecture documentation deploy. | [preview](https://connect-intel-9awk8izua-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- dc4d264` |
| 01/07/2026, 23:22:53 | `548cdb9` | Add enterprise architecture documentation and constitution gap analysis. | [preview](https://connect-intel-4rwq4ysnw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 548cdb9` |
| 01/07/2026, 23:12:58 | `6376deb` | Update production log after rep and solo dashboard deploy. | [preview](https://connect-intel-d9uf4ekp2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6376deb` |
| 01/07/2026, 23:12:04 | `9ea5b20` | Give reps and solo users the enterprise home dashboard. | [preview](https://connect-intel-m36y6tpey-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9ea5b20` |
| 01/07/2026, 23:08:47 | `70c758b` | Update production log after P2 enterprise dashboard deploy. | [preview](https://connect-intel-9vl6v2nit-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 70c758b` |
| 01/07/2026, 23:07:49 | `b3264c7` | Add enterprise dashboard P2: customizable widgets, live pulse, and Opportunities hub. | [preview](https://connect-intel-2j8yne4um-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b3264c7` |
| 01/07/2026, 22:58:42 | `74ee142` | Update production log after enterprise dashboard UI deploy. | [preview](https://connect-intel-694ra8jbd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 74ee142` |
| 01/07/2026, 22:57:59 | `45b3250` | Upgrade home dashboard to enterprise CRM layout and UX. | [preview](https://connect-intel-bedfdcaex-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 45b3250` |
| 01/07/2026, 22:36:20 | `33f9985` | Update production log after enterprise dashboard deploy. | [preview](https://connect-intel-fq1qraxam-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 33f9985` |
| 01/07/2026, 22:35:36 | `ccd8fd6` | Align manager dashboard with enterprise snapshot architecture. | [preview](https://connect-intel-mok8r1neh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ccd8fd6` |

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
