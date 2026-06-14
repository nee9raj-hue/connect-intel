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
npm run prod:rollback -- 6759962
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
| Commit | `f2949dc` |
| Log updated (IST) | 14/06/2026, 15:47:37 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 14/06/2026, 15:47:25 | `f2949dc` | Polish pipeline list view with premium icons, motion, and empty states. | [preview](https://connect-intel-4bxe1ngx4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f2949dc` | **← LIVE**
| 14/06/2026, 15:37:50 | `6759962` | Replace pipeline row ellipsis with labeled Actions trigger. | [preview](https://connect-intel-7lfzqqtvh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6759962` |
| 14/06/2026, 15:29:30 | `c3d521c` | Fix timeline rail dots clipped on the left in lead panel. | [preview](https://connect-intel-jvbn5675n-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c3d521c` |
| 14/06/2026, 15:22:33 | `269076b` | Redesign lead Deals tab with compact cards and icon controls. | [preview](https://connect-intel-ghq3uemsi-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 269076b` |
| 14/06/2026, 15:14:25 | `5f2d3b3` | Redesign lead record panel with icon tabs and premium workspace UI. | [preview](https://connect-intel-llrszyt11-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5f2d3b3` |
| 14/06/2026, 15:02:49 | `444a32e` | Remove duplicate lead count from pipeline filter bar. | [preview](https://connect-intel-rljvis9m2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 444a32e` |
| 14/06/2026, 14:57:43 | `4f75292` | Move pipeline view settings to header actions away from filter bar. | [preview](https://connect-intel-3s8joap34-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4f75292` |
| 14/06/2026, 14:48:33 | `dfd3e32` | Move pipeline view settings to top-right header actions. | [preview](https://connect-intel-490gpx13g-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- dfd3e32` |
| 14/06/2026, 14:43:07 | `611c8e0` | Redesign pipeline filter command bar with icon pills and search. | [preview](https://connect-intel-1xn6uafn3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 611c8e0` |
| 14/06/2026, 14:34:05 | `384e859` | Fix pipeline email column staying orange due to global link styles. | [preview](https://connect-intel-oycy07gfi-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 384e859` |
| 14/06/2026, 14:28:15 | `374efad` | Style pipeline email addresses in blue for quick visual scan. | [preview](https://connect-intel-l2d77sjpt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 374efad` |
| 14/06/2026, 12:17:31 | `419f7e1` | Add Team review block on dashboard for managers and admins. | [preview](https://connect-intel-okxixc3lp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 419f7e1` |
| 14/06/2026, 12:09:46 | `07367b6` | Redesign freight deals dashboard with professional table and KPIs. | [preview](https://connect-intel-nkf65fvr8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 07367b6` |
| 14/06/2026, 12:05:36 | `058ce95` | Upgrade pipeline health chart with distribution bar and column chart. | [preview](https://connect-intel-qpdyu8is3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 058ce95` |
| 14/06/2026, 11:59:26 | `61c9984` | Rebuild CRM home dashboard as role-aware command center. | [preview](https://connect-intel-osmf1uswt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 61c9984` |
| 13/06/2026, 20:45:10 | `e12df7c` | Upgrade analytics page charts with full-width pro visuals. | [preview](https://connect-intel-leniuo0co-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e12df7c` |
| 13/06/2026, 20:39:36 | `27eb4a8` | Modernize campaign report funnel and full-width activity chart. | [preview](https://connect-intel-50vfp1c8l-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 27eb4a8` |
| 13/06/2026, 20:33:12 | `98803b4` | Fix analytics 0% open rates by using campaign-scoped event metrics. | [preview](https://connect-intel-qdnlvofgt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 98803b4` |
| 13/06/2026, 20:22:02 | `a16eec8` | Redesign campaign reports list with cleaner tabs, toolbar, and KPI strip. | [preview](https://connect-intel-3bskzyza1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a16eec8` |
| 13/06/2026, 20:17:56 | `87a3c25` | Fix 5xx on /api by removing heavy enrollment reads from marketing overview. | [preview](https://connect-intel-hbz8itk3k-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 87a3c25` |

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
