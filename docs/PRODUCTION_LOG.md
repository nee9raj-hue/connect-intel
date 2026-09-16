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
npm run prod:rollback -- e9d4223
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
| Commit | `5b84a41` |
| Log updated (IST) | 16/09/2026, 10:17:06 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 16/09/2026, 10:16:35 | `5b84a41` | Replace deal forecast pills with filter-aware customers, booked, and lost totals. | [preview](https://connect-intel-5fmbfzl9t-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5b84a41` | **← LIVE**
| 16/09/2026, 00:55:20 | `e9d4223` | Merge branch 'cursor/fix-deals-mobile-view-802f' | [preview](https://connect-intel-6no09lt5d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e9d4223` |
| 15/09/2026, 22:51:43 | `330496d` | Record production deploy 5f39971 as LIVE. | [preview](https://connect-intel-2j0mrvxwx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 330496d` |
| 15/09/2026, 22:50:31 | `5f39971` | Collapse lead deal cards by default so multiple deals scan as a latest-first list. | [preview](https://connect-intel-fz2gyjq0j-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5f39971` |
| 15/09/2026, 22:39:26 | `2ad137f` | Record production deploy 7a2220c as LIVE. | [preview](https://connect-intel-iyoi2shpo-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2ad137f` |
| 15/09/2026, 22:37:56 | `7a2220c` | Use customer dates in deal range filters and a single Won/Booked/Lost outcome. | [preview](https://connect-intel-3tc86vzg9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7a2220c` |
| 15/09/2026, 22:17:33 | `57e7320` | Record production deploy efd7f1a as LIVE. | [preview](https://connect-intel-rejobcu8b-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 57e7320` |
| 15/09/2026, 22:16:13 | `efd7f1a` | Let reps record actual RFQ, quote, booked, won, and lost dates on deals. | [preview](https://connect-intel-oqrhodnvp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- efd7f1a` |
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
