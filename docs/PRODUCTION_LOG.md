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
npm run prod:rollback -- 1161bea
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
| Commit | `5f98b52` |
| Log updated (IST) | 12/07/2026, 12:16:50 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 12/07/2026, 12:16:31 | `5f98b52` | Add enterprise SSO Vercel connect script and setup guide. | [preview](https://connect-intel-dys6ghpbd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5f98b52` | **← LIVE**
| 12/07/2026, 10:42:49 | `1161bea` | Wire enterprise SSO buttons on login from public-config auth block. | [preview](https://connect-intel-3b2fa5sjd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1161bea` |
| 12/07/2026, 10:39:31 | `b55e909` | Add enterprise auth abstraction with Azure AD and Okta OIDC (Infrastructure V2 P3). | [preview](https://connect-intel-85nu9x8ys-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b55e909` |
| 12/07/2026, 10:35:14 | `a2e6e63` | Add Postgres document store backend for Infrastructure V2 P2. | [preview](https://connect-intel-4an4dzqtu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a2e6e63` |
| 12/07/2026, 10:31:26 | `ec4aff0` | Complete Infrastructure V2 P1 pipeline GET migration per blueprint. | [preview](https://connect-intel-dif65ur29-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ec4aff0` |
| 12/07/2026, 10:22:34 | `30c9ce8` | Migrate companies hub to platform repository layer (Infrastructure V2 P1). | [preview](https://connect-intel-8pctlhli8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 30c9ce8` |
| 12/07/2026, 10:00:36 | `d2b08f0` | Add Enterprise Infrastructure V2 platform kernel and Docker support. | [preview](https://connect-intel-2xcii1pf5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d2b08f0` |
| 11/07/2026, 21:40:16 | `f7e6207` | Exempt data-sync cron from RBAC mutation audit. | [preview](https://connect-intel-nwrwya9es-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f7e6207` |
| 11/07/2026, 21:40:01 | `954461a` | Fix prod:ops vercel cron trigger when query params are set. | [preview](https://connect-intel-lv3qn4aji-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 954461a` |
| 11/07/2026, 21:37:05 | `5bee522` | Add production data-sync cron for pipeline and companies backfill. | [preview](https://connect-intel-6l8sb8jdb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5bee522` |
| 11/07/2026, 19:20:06 | `6591d52` | Add prod smoke checks and phased rollout playbook. | [preview](https://connect-intel-hqn3wmifk-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6591d52` |
| 11/07/2026, 19:03:19 | `191ff22` | Add CRM technical PRD document and platform operator access rule. | [preview](https://connect-intel-a6y6hyeix-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 191ff22` |
| 11/07/2026, 18:08:48 | `7585344` | Keep platform operator panels internal and refresh admin access on session. | [preview](https://connect-intel-af14c77jy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7585344` |
| 11/07/2026, 17:46:16 | `be093aa` | Fix Copilot section heading color on dark landing panel. | [preview](https://connect-intel-pkder04bz-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- be093aa` |
| 11/07/2026, 17:43:50 | `ea40447` | Improve global commerce map contrast and scale on landing. | [preview](https://connect-intel-56nnuo13w-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ea40447` |
| 11/07/2026, 17:36:56 | `48f1b19` | Replace landing SVG globe with global commerce map asset. | [preview](https://connect-intel-6cdxsayb6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 48f1b19` |
| 11/07/2026, 17:21:58 | `473d470` | Stabilize landing layout and improve global commerce map polish. | [preview](https://connect-intel-rksbnmtm3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 473d470` |
| 11/07/2026, 17:12:29 | `3642369` | Evolve landing into product-story experience with live UI demos. | [preview](https://connect-intel-fx557qgj5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3642369` |

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
