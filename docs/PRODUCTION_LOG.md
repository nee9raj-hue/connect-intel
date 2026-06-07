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
npm run prod:rollback -- 4dd9c06
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
| Commit | `ef4045e` |
| Log updated (IST) | 07/06/2026, 09:44:41 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 07/06/2026, 09:44:26 | `ef4045e` | Show rep work email in CRM Reply-To so leads see a familiar address. | [preview](https://connect-intel-adxbodjer-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ef4045e` | **← LIVE**
| 07/06/2026, 09:40:11 | `4dd9c06` | Log production deploy ddecae2 (CRM email trail prune and sort). | [preview](https://connect-intel-er47x6uw6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4dd9c06` |
| 07/06/2026, 09:39:24 | `ddecae2` | Prune CRM email threads to trail-only and show newest first. | [preview](https://connect-intel-ekyygj5qb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ddecae2` |
| 07/06/2026, 09:32:16 | `66b8d5f` | Fix inbound reply not saving on org pipeline shards. | [preview](https://connect-intel-841jgg4e9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 66b8d5f` |
| 07/06/2026, 09:26:24 | `7da4381` | Add GET health check on CRM inbound email webhook. | [preview](https://connect-intel-j3ggvp2a8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7da4381` |
| 07/06/2026, 09:07:20 | `eaa453f` | Add inbound email reply sync without gmail.readonly. | [preview](https://connect-intel-1sg9dvn2k-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- eaa453f` |
| 06/06/2026, 18:30:21 | `4e92363` | Fix team dashboard timeouts on large org pipelines. | [preview](https://connect-intel-gppe5w925-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4e92363` |
| 06/06/2026, 18:23:39 | `03cb50e` | Polish dashboard KPI cards and marketing stats layout. | [preview](https://connect-intel-75qkueunb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 03cb50e` |
| 06/06/2026, 18:21:17 | `81d0c89` | Fix team KPI activity counts and per-rep filter behavior. | [preview](https://connect-intel-6ry1417fa-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 81d0c89` |
| 06/06/2026, 18:12:17 | `9905b8b` | Fix dashboard timeouts on large pipelines and stale assignee filter. | [preview](https://connect-intel-mgvu4p9zp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9905b8b` |
| 06/06/2026, 18:07:01 | `389592e` | Fix team KPI counts using activity-log touchpoint rollup. | [preview](https://connect-intel-68cpkvzpl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 389592e` |
| 06/06/2026, 18:00:34 | `5439971` | Fix team intelligence KPIs to count org-wide CRM activity. | [preview](https://connect-intel-hbe0wa28p-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5439971` |
| 06/06/2026, 17:35:50 | `e3709ea` | Fix team dashboard metrics, card navigation, and KPI styling. | [preview](https://connect-intel-2ergfnhbw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e3709ea` |
| 06/06/2026, 17:27:56 | `6b37e1c` | Fix broken pipelineMaintain import that crashed production API. | [preview](https://connect-intel-fd0e9bepk-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6b37e1c` |
| 06/06/2026, 17:22:30 | `a69af6b` | Fix empty pipeline and dashboard when shard copy is stale or blank. | [preview](https://connect-intel-78ygyhnxt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a69af6b` |
| 06/06/2026, 17:17:06 | `40d1205` | Fix CRM data loss when pipeline shards and savedLeads diverged. | [preview](https://connect-intel-cf5t85xmr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 40d1205` |
| 06/06/2026, 17:03:47 | `f2a2ade` | Add lead call logging and unify team intelligence on Dashboard. | [preview](https://connect-intel-f02szd0g3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f2a2ade` |

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
