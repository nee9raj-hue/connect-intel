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
npm run prod:rollback -- 28c3c92
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
| Commit | `f22177a` |
| Log updated (IST) | 14/07/2026, 13:28:49 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 14/07/2026, 13:28:42 | `f22177a` | Ship competitive CRM plans with Free 1/100 and Xindus override. | [preview](https://connect-intel-ptsieevr7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f22177a` | **← LIVE**
| 14/07/2026, 10:31:13 | `28c3c92` | Make Vercel crons Hobby-safe for free-tier production. | [preview](https://connect-intel-eojwznqfy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 28c3c92` |
| 14/07/2026, 10:15:49 | `aa2acb7` | Add Infrastructure V2 P4 storage adapters and harden Azure SSO. | [preview](https://connect-intel-buzpup2lm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- aa2acb7` |
| 12/07/2026, 13:29:37 | `5f98b52` | Add enterprise SSO Vercel connect script and setup guide. | [preview](https://connect-intel-g1rp3795y-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5f98b52` |
| 12/07/2026, 10:42:49 | `1161bea` | Wire enterprise SSO buttons on login from public-config auth block. | [preview](https://connect-intel-3b2fa5sjd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1161bea` |
| 12/07/2026, 10:39:31 | `b55e909` | Add enterprise auth abstraction with Azure AD and Okta OIDC (Infrastructure V2 P3). | [preview](https://connect-intel-85nu9x8ys-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b55e909` |
| 12/07/2026, 10:35:14 | `a2e6e63` | Add Postgres document store backend for Infrastructure V2 P2. | [preview](https://connect-intel-4an4dzqtu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a2e6e63` |
| 12/07/2026, 10:31:26 | `ec4aff0` | Complete Infrastructure V2 P1 pipeline GET migration per blueprint. | [preview](https://connect-intel-dif65ur29-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ec4aff0` |
| 12/07/2026, 10:22:34 | `30c9ce8` | Migrate companies hub to platform repository layer (Infrastructure V2 P1). | [preview](https://connect-intel-8pctlhli8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 30c9ce8` |
| 12/07/2026, 10:00:36 | `d2b08f0` | Add Enterprise Infrastructure V2 platform kernel and Docker support. | [preview](https://connect-intel-2xcii1pf5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d2b08f0` |
| 11/07/2026, 21:40:16 | `f7e6207` | Exempt data-sync cron from RBAC mutation audit. | [preview](https://connect-intel-nwrwya9es-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f7e6207` |
| 11/07/2026, 21:40:01 | `954461a` | Fix prod:ops vercel cron trigger when query params are set. | [preview](https://connect-intel-lv3qn4aji-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 954461a` |
| 11/07/2026, 21:37:05 | `5bee522` | Add production data-sync cron for pipeline and companies backfill. | [preview](https://connect-intel-6l8sb8jdb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5bee522` |

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
