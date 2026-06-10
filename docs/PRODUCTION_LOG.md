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
npm run prod:rollback -- 38357bc
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
| Commit | `db3b924` |
| Log updated (IST) | 10/06/2026, 16:48:04 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 10/06/2026, 16:48:00 | `db3b924` | Fix team hierarchy assignment and speed up settings loads. | [preview](https://connect-intel-6th7nwwei-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- db3b924` | **← LIVE**
| 10/06/2026, 16:34:35 | `38357bc` | Update production log after settings hub deploy. | [preview](https://connect-intel-224pgdf4j-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 38357bc` |
| 10/06/2026, 16:33:49 | `517219f` | Rebuild Team settings as HubSpot-style tabbed admin hub. | [preview](https://connect-intel-d8kf35eny-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 517219f` |
| 10/06/2026, 16:19:29 | `bf41817` | Update production log after departments nav deploy. | [preview](https://connect-intel-5qualwjb6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bf41817` |
| 10/06/2026, 16:18:34 | `7059942` | Surface Departments & teams in sidebar with URL deep links. | [preview](https://connect-intel-1sokgx894-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7059942` |
| 10/06/2026, 16:13:28 | `ea59b80` | Polish Org Admin: member roles, moves, deactivate, and import stats. | [preview](https://connect-intel-fduehr25f-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ea59b80` |
| 10/06/2026, 16:09:01 | `0349be6` | Add Org Admin hub with departments, teams, and permissions matrix. | [preview](https://connect-intel-bdrik1uy9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0349be6` |
| 10/06/2026, 16:01:47 | `e7961d6` | Add pipeline keyset pagination and Sprint 1 performance reliability. | [preview](https://connect-intel-aozpg6zbp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e7961d6` |
| 10/06/2026, 15:20:51 | `409bd68` | Add DB-level team hierarchy RBAC for pipeline scoping and sidebar counts. | [preview](https://connect-intel-4gr87irfw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 409bd68` |
| 10/06/2026, 14:22:06 | `c80f60a` | Add SQL-backed marketing email queue and analytics snapshots. | [preview](https://connect-intel-m0i6u6x23-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c80f60a` |
| 10/06/2026, 13:51:56 | `352fb9a` | Allow marketing bulk email via browser drain when Redis is off. | [preview](https://connect-intel-4nzpxvkm7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 352fb9a` |
| 10/06/2026, 13:25:04 | `246e238` | Fix marketing template saves timing out on large org stores. | [preview](https://connect-intel-4ha2mjqt2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 246e238` |
| 10/06/2026, 13:08:10 | `d4e9c16` | Restructure sidebar into Home, CRM/Sales, and Analytics sections. | [preview](https://connect-intel-10vx0iqkb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d4e9c16` |
| 10/06/2026, 12:38:01 | `18f6ddb` | Harden activity-log bootstrap when pipeline_activities table is missing. | [preview](https://connect-intel-9o788ufkg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 18f6ddb` |
| 10/06/2026, 12:32:47 | `f88341a` | Add production bootstrap actions for activity log backfill and snapshot warm. | [preview](https://connect-intel-osx5oguh7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f88341a` |
| 10/06/2026, 12:29:21 | `fa5d86c` | Speed up activity log with indexed queries and snapshot reads. | [preview](https://connect-intel-ecefxax7v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- fa5d86c` |
| 10/06/2026, 12:19:07 | `e6df7b6` | Route post-login users to /home/dashboard by default. | [preview](https://connect-intel-dx13ig39x-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e6df7b6` |
| 10/06/2026, 12:02:30 | `adc124a` | Harden sign-in against Supabase 521 timeouts and Redis quota outages. | [preview](https://connect-intel-n6efhvuat-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- adc124a` |
| 10/06/2026, 11:54:26 | `98eebc1` | Wire enterprise leads read/write through decrypted_leads and encrypted_* sync. | [preview](https://connect-intel-2004nyomj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 98eebc1` |

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
