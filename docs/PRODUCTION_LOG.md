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
npm run prod:rollback -- 85761b1
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
| Commit | `c69dabf` |
| Log updated (IST) | 07/06/2026, 10:54:13 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 07/06/2026, 10:53:53 | `c69dabf` | Fix inActivityPeriod ReferenceError in crmTouchpoints. | [preview](https://connect-intel-86xiisxya-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c69dabf` | **← LIVE**
| 07/06/2026, 10:52:34 | `85761b1` | Log production deploy 491231d (dashboard KPI activity count fix). | [preview](https://connect-intel-32cv678uc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 85761b1` |
| 07/06/2026, 10:51:34 | `491231d` | Fix dashboard KPIs by sharing activity log counting logic. | [preview](https://connect-intel-lqx5zglz1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 491231d` |
| 07/06/2026, 10:38:08 | `143ec4f` | Fix dashboard KPIs by merging CRM activity like the activity log. | [preview](https://connect-intel-3qcrxrxno-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 143ec4f` |
| 07/06/2026, 10:34:29 | `a1ee2a9` | Fix dashboard KPIs by merging monolith CRM activity into shard reads. | [preview](https://connect-intel-x6x7luqzr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a1ee2a9` |
| 07/06/2026, 10:24:29 | `07ad2b0` | Fix dashboard showing admin stats for every team member filter. | [preview](https://connect-intel-amyrq1mgt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 07ad2b0` |
| 07/06/2026, 10:18:41 | `120803f` | Fix team dashboard per-rep filtering, day view, and full activity logs. | [preview](https://connect-intel-dqv6uzihy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 120803f` |
| 07/06/2026, 10:13:22 | `3ecf39a` | Fix team dashboard KPIs from full pipeline activity logs. | [preview](https://connect-intel-c4v79d8fe-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3ecf39a` |
| 07/06/2026, 10:04:50 | `ab3d1b1` | Log production deploy 685980a (inbound CRM reply sync fix). | [preview](https://connect-intel-qwvifgojf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ab3d1b1` |
| 07/06/2026, 10:04:04 | `685980a` | Fix inbound CRM reply sync on org shards and auto-refresh email threads. | [preview](https://connect-intel-ai4fz8qtt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 685980a` |
| 07/06/2026, 09:45:10 | `1fce29e` | Log production deploy ef4045e (friendly CRM Reply-To display). | [preview](https://connect-intel-ph0xdpj7v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1fce29e` |
| 07/06/2026, 09:44:26 | `ef4045e` | Show rep work email in CRM Reply-To so leads see a familiar address. | [preview](https://connect-intel-adxbodjer-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ef4045e` |
| 07/06/2026, 09:40:11 | `4dd9c06` | Log production deploy ddecae2 (CRM email trail prune and sort). | [preview](https://connect-intel-er47x6uw6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4dd9c06` |
| 07/06/2026, 09:39:24 | `ddecae2` | Prune CRM email threads to trail-only and show newest first. | [preview](https://connect-intel-ekyygj5qb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ddecae2` |
| 07/06/2026, 09:32:16 | `66b8d5f` | Fix inbound reply not saving on org pipeline shards. | [preview](https://connect-intel-841jgg4e9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 66b8d5f` |
| 07/06/2026, 09:26:24 | `7da4381` | Add GET health check on CRM inbound email webhook. | [preview](https://connect-intel-j3ggvp2a8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7da4381` |
| 07/06/2026, 09:07:20 | `eaa453f` | Add inbound email reply sync without gmail.readonly. | [preview](https://connect-intel-1sg9dvn2k-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- eaa453f` |
| 06/06/2026, 18:30:21 | `4e92363` | Fix team dashboard timeouts on large org pipelines. | [preview](https://connect-intel-gppe5w925-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4e92363` |

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
