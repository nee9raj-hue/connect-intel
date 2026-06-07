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
npm run prod:rollback -- 636afe1
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
| Commit | `38bd279` |
| Log updated (IST) | 07/06/2026, 13:00:33 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 07/06/2026, 13:00:21 | `38bd279` | Use freight-specific deal stages instead of lead pipeline statuses. | [preview](https://connect-intel-mj8myxp8h-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 38bd279` | **← LIVE**
| 07/06/2026, 12:50:51 | `636afe1` | Log production deploy 873c78e (freight deal pipeline nav). | [preview](https://connect-intel-er91bkjol-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 636afe1` |
| 07/06/2026, 12:50:04 | `873c78e` | Add freight deal pipeline nav, dashboard block, and transport mode. | [preview](https://connect-intel-7gk6w4khj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 873c78e` |
| 07/06/2026, 12:39:09 | `fcfd004` | Log production deploy 20d32df (pipeline timeout fixes). | [preview](https://connect-intel-c9wjr2amh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- fcfd004` |
| 07/06/2026, 12:38:25 | `20d32df` | Fix pipeline timeouts for large orgs and freight deal saves. | [preview](https://connect-intel-nl47y7yrf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 20d32df` |
| 07/06/2026, 12:33:24 | `bc025ed` | Log production deploy 2c03ebe (freight RFQ on deals for Xindus). | [preview](https://connect-intel-nsgzbwrnz-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bc025ed` |
| 07/06/2026, 12:32:30 | `2c03ebe` | Add freight RFQ fields on deals for Xindus shipping workflows. | [preview](https://connect-intel-ni7d07ah4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2c03ebe` |
| 07/06/2026, 12:19:57 | `9e5f604` | Log production deploy 07c306d (multi-deal flow per lead). | [preview](https://connect-intel-3s9vg7mjq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9e5f604` |
| 07/06/2026, 12:19:01 | `07c306d` | Add HubSpot-style multi-deal flow per lead. | [preview](https://connect-intel-1tea6ypih-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 07c306d` |
| 07/06/2026, 11:06:48 | `8d36006` | Log production deploy ba6d814 (faster task and meeting saves). | [preview](https://connect-intel-gmav9azy3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8d36006` |
| 07/06/2026, 11:05:51 | `ba6d814` | Speed up task and meeting saves with clearer success feedback. | [preview](https://connect-intel-99kkiuedy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ba6d814` |
| 07/06/2026, 10:54:42 | `e4fd719` | Log production deploy c69dabf (inActivityPeriod ReferenceError fix). | [preview](https://connect-intel-5m77n9gw2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e4fd719` |
| 07/06/2026, 10:53:53 | `c69dabf` | Fix inActivityPeriod ReferenceError in crmTouchpoints. | [preview](https://connect-intel-86xiisxya-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c69dabf` |
| 07/06/2026, 10:52:34 | `85761b1` | Log production deploy 491231d (dashboard KPI activity count fix). | [preview](https://connect-intel-32cv678uc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 85761b1` |
| 07/06/2026, 10:51:34 | `491231d` | Fix dashboard KPIs by sharing activity log counting logic. | [preview](https://connect-intel-lqx5zglz1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 491231d` |
| 07/06/2026, 10:38:08 | `143ec4f` | Fix dashboard KPIs by merging CRM activity like the activity log. | [preview](https://connect-intel-3qcrxrxno-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 143ec4f` |
| 07/06/2026, 10:34:29 | `a1ee2a9` | Fix dashboard KPIs by merging monolith CRM activity into shard reads. | [preview](https://connect-intel-x6x7luqzr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a1ee2a9` |
| 07/06/2026, 10:24:29 | `07ad2b0` | Fix dashboard showing admin stats for every team member filter. | [preview](https://connect-intel-amyrq1mgt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 07ad2b0` |
| 07/06/2026, 10:18:41 | `120803f` | Fix team dashboard per-rep filtering, day view, and full activity logs. | [preview](https://connect-intel-dqv6uzihy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 120803f` |
| 07/06/2026, 10:13:22 | `3ecf39a` | Fix team dashboard KPIs from full pipeline activity logs. | [preview](https://connect-intel-c4v79d8fe-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3ecf39a` |

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
