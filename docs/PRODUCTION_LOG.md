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
npm run prod:rollback -- bc47465
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
| Commit | `bf5f67d` |
| Log updated (IST) | 16/09/2026, 16:34:05 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 16/09/2026, 16:33:41 | `bf5f67d` | Restrict pipeline and deal delete to Org Admin. | [preview](https://connect-intel-fgdohfv1i-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bf5f67d` | **← LIVE**
| 16/09/2026, 13:39:03 | `bc47465` | Record production deploy 040421e as LIVE. | [preview](https://connect-intel-9ljchbdwh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bc47465` |
| 16/09/2026, 13:36:45 | `040421e` | Replace Pipeline Deals date range with cascaded Year, Month, and Week Number filters. | [preview](https://connect-intel-e0c22a7r5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 040421e` |
| 16/09/2026, 13:21:38 | `7dd1fca` | Record production deploy ca41c41 as LIVE. | [preview](https://connect-intel-iq5tbtbkh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7dd1fca` |
| 16/09/2026, 13:19:41 | `ca41c41` | Remove duplicate deal-stage pills from the Pipeline Deals header. | [preview](https://connect-intel-3mucw1fpr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ca41c41` |
| 16/09/2026, 13:06:38 | `0c6ebce` | Record production deploy 796697d as LIVE. | [preview](https://connect-intel-41bhsp2bw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0c6ebce` |
| 16/09/2026, 13:02:28 | `796697d` | Fix Copilot crashing with Unexpected identifier pipeline_leads. | [preview](https://connect-intel-mr56j4wiq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 796697d` |
| 16/09/2026, 12:31:48 | `bbbc423` | Record production deploy 3e01162 as LIVE. | [preview](https://connect-intel-54202nnf5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bbbc423` |
| 16/09/2026, 12:29:22 | `3e01162` | Keep Copilot as a single header CRM assistant without web theater. | [preview](https://connect-intel-q7lg52doc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3e01162` |
| 16/09/2026, 12:09:40 | `b6fd53c` | Record production deploy b6dd140 as LIVE. | [preview](https://connect-intel-mk8g4ojkw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b6fd53c` |
| 16/09/2026, 12:08:45 | `b6dd140` | Show deal stages in the lead and pipeline headers and relink leftover deals. | [preview](https://connect-intel-knbfix8k4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b6dd140` |
| 16/09/2026, 11:25:00 | `ee3b6d8` | Record production deploy 7cdb395 as LIVE. | [preview](https://connect-intel-d02wvwfde-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ee3b6d8` |
| 16/09/2026, 11:23:11 | `7cdb395` | Restore mergeLeadForClientListMinimal on bulk CRM updates. | [preview](https://connect-intel-k20bot1s1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7cdb395` |
| 16/09/2026, 11:18:33 | `4ee3dd6` | Record production deploy b1d8427 as LIVE. | [preview](https://connect-intel-3d947jtw3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4ee3dd6` |
| 16/09/2026, 11:16:23 | `b1d8427` | Replace generic CRM lead stages with a freight account lifecycle. | [preview](https://connect-intel-h4140ezpn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b1d8427` |
| 16/09/2026, 10:17:47 | `471a346` | Record production deploy 5b84a41 as LIVE. | [preview](https://connect-intel-j3ozoomt4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 471a346` |
| 16/09/2026, 10:16:35 | `5b84a41` | Replace deal forecast pills with filter-aware customers, booked, and lost totals. | [preview](https://connect-intel-5fmbfzl9t-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5b84a41` |
| 16/09/2026, 00:55:20 | `e9d4223` | Merge branch 'cursor/fix-deals-mobile-view-802f' | [preview](https://connect-intel-6no09lt5d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e9d4223` |
| 15/09/2026, 22:51:43 | `330496d` | Record production deploy 5f39971 as LIVE. | [preview](https://connect-intel-2j0mrvxwx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 330496d` |

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
