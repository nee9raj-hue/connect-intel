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
npm run prod:rollback -- c3d00e3
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
| Commit | `efd7f1a` |
| Log updated (IST) | 15/09/2026, 22:16:38 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 15/09/2026, 22:16:13 | `efd7f1a` | Let reps record actual RFQ, quote, booked, won, and lost dates on deals. | [preview](https://connect-intel-oqrhodnvp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- efd7f1a` | **← LIVE**
| 15/09/2026, 22:00:59 | `c3d00e3` | Record production deploy d874acd as LIVE. | [preview](https://connect-intel-oex9p0yv1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c3d00e3` |
| 15/09/2026, 21:59:53 | `d874acd` | Allow freight edits on every deal stage, including Won and Lost. | [preview](https://connect-intel-e9hr0f24c-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d874acd` |
| 15/09/2026, 21:55:47 | `ec57021` | Record production deploy f30b3e6 as LIVE. | [preview](https://connect-intel-pdlhd9qgl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ec57021` |
| 15/09/2026, 21:54:46 | `f30b3e6` | Show freight fields on open deals so reps can update quoted rates. | [preview](https://connect-intel-orlb9dgld-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f30b3e6` |
| 15/09/2026, 21:49:27 | `d1f1474` | Record production deploy 2f8de67 as LIVE. | [preview](https://connect-intel-exhj1cl31-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d1f1474` |
| 15/09/2026, 21:48:23 | `2f8de67` | Treat ocean freight as USD and convert revenue to INR. | [preview](https://connect-intel-fzkw3fjnq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2f8de67` |
| 15/09/2026, 21:35:31 | `83b8beb` | Record production deploy bc4ccd6 as LIVE. | [preview](https://connect-intel-in15dktzu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 83b8beb` |
| 15/09/2026, 21:33:49 | `bc4ccd6` | Replace All Deals stage pills with a multi-select dropdown. | [preview](https://connect-intel-g4ykah2i0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bc4ccd6` |
| 15/09/2026, 21:24:28 | `1901df4` | Record production deploy d5cf838 as LIVE. | [preview](https://connect-intel-q5wgk6kvt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1901df4` |
| 15/09/2026, 21:23:20 | `d5cf838` | Show the same Lost deals in the list as in the sidebar count. | [preview](https://connect-intel-nbgmun7tm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d5cf838` |
| 15/09/2026, 21:14:47 | `e1ba15e` | Record production deploy 7a435e1 as LIVE. | [preview](https://connect-intel-g3xw2ovrg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e1ba15e` |
| 15/09/2026, 21:13:33 | `7a435e1` | Show All Deals with estimated freight revenue and stage filters. | [preview](https://connect-intel-8yok9odd1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7a435e1` |
| 15/09/2026, 11:04:15 | `49b5248` | Record production deploy e08802c as LIVE. | [preview](https://connect-intel-h0wcafse4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 49b5248` |
| 15/09/2026, 11:01:47 | `e08802c` | Fix sidebar Deals counts from pipeline_deals, matching Lost list. | [preview](https://connect-intel-2hztsi2nz-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e08802c` |
| 15/09/2026, 09:55:11 | `517d130` | Clear stale PWA cache when PipelineDealsView is missing. | [preview](https://connect-intel-dr7z7wkl4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 517d130` |
| 15/09/2026, 09:39:04 | `4cb761a` | Fix pipeline deals crash from missing PipelineDealsView import. | [preview](https://connect-intel-6ivfe60d8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4cb761a` |
| 14/07/2026, 13:29:42 | `3b47342` | Record production deploy f22177a as LIVE. | [preview](https://connect-intel-8np5lw2gs-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3b47342` |
| 14/07/2026, 13:28:42 | `f22177a` | Ship competitive CRM plans with Free 1/100 and Xindus override. | [preview](https://connect-intel-ptsieevr7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f22177a` |
| 14/07/2026, 10:31:13 | `28c3c92` | Make Vercel crons Hobby-safe for free-tier production. | [preview](https://connect-intel-eojwznqfy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 28c3c92` |

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
