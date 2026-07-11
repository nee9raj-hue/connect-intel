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
npm run prod:rollback -- bd0b68f
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
| Commit | `d53458e` |
| Log updated (IST) | 11/07/2026, 15:25:49 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 11/07/2026, 15:25:13 | `d53458e` | Unify CRM workflow dispatch and pass Blueprint Phase 2+ gate. | [preview](https://connect-intel-g7oqzopxa-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d53458e` | **← LIVE**
| 11/07/2026, 14:25:03 | `bd0b68f` | Add Railway Meilisearch redeploy tooling and ops guide. | [preview](https://connect-intel-b9t54joox-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bd0b68f` |
| 11/07/2026, 14:11:51 | `e2c53de` | Add CWS publish helpers, PRD overview assets, and production log. | [preview](https://connect-intel-pp5ir8eow-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e2c53de` |
| 11/07/2026, 14:09:46 | `5771b23` | Use Meilisearch-safe document IDs without colons. | [preview](https://connect-intel-dbe25ox7d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5771b23` |
| 11/07/2026, 14:08:13 | `ef70de8` | Fix campaigns_v3 recipient upsert and Meilisearch task completion. | [preview](https://connect-intel-13y08tjid-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ef70de8` |
| 11/07/2026, 14:02:37 | `8973ff0` | Speed up dashboard bootstrap and team metrics for Step 10 gate. | [preview](https://connect-intel-p9j916kng-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8973ff0` |
| 10/07/2026, 17:24:29 | `51e8d05` | Add Google Search Console site verification meta tag. | [preview](https://connect-intel-m8uyqat48-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 51e8d05` |
| 10/07/2026, 16:59:23 | `34f04f2` | Fix extension install config and default invite search access for reps. | [preview](https://connect-intel-nz2gdpreh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 34f04f2` |
| 10/07/2026, 16:49:30 | `5d4eb41` | Bundle collaborator SQL migration for Vercel bootstrap ops. | [preview](https://connect-intel-i46kuzpt7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5d4eb41` |
| 10/07/2026, 16:46:20 | `9758638` | Fix rep lead sharing visibility and surface Chrome extension install link. | [preview](https://connect-intel-m2pvmbaon-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9758638` |
| 10/07/2026, 14:22:21 | `1ccdc3b` | Support manager role when demoting org admin during transfer. | [preview](https://connect-intel-gakxhlc4v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1ccdc3b` |
| 10/07/2026, 14:19:31 | `f290bba` | Add ops endpoint to invite org members via CRON bootstrap. | [preview](https://connect-intel-at5p4tl15-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f290bba` |
| 10/07/2026, 14:08:08 | `9998c8f` | Skip customer onboarding for invite@ platform operator login. | [preview](https://connect-intel-3399nr58m-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9998c8f` |
| 10/07/2026, 13:47:14 | `ac2e3b7` | Grant company admin via platform support for invite access. | [preview](https://connect-intel-fu4sgo2za-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ac2e3b7` |
| 10/07/2026, 13:38:30 | `35fdaad` | Add invite-only company join flow with access requests. | [preview](https://connect-intel-mplzmfr1g-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 35fdaad` |
| 10/07/2026, 13:19:36 | `8dc1d1a` | Add sign-out escape hatch on onboarding modal. | [preview](https://connect-intel-a55ad6wjs-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8dc1d1a` |
| 10/07/2026, 13:06:37 | `2811f4b` | Enable Gmail onboarding prompt via runtime public-config flag. | [preview](https://connect-intel-rh4q04pa0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2811f4b` |
| 10/07/2026, 12:52:39 | `8b923f9` | Wire Connect Copilot to grounded deal forecast answers. | [preview](https://connect-intel-zscf48p9a-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8b923f9` |
| 10/07/2026, 12:44:24 | `bc23526` | Add stage-weighted deal forecasting to Pipeline Deals view. | [preview](https://connect-intel-gcwoetiqa-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bc23526` |
| 10/07/2026, 12:29:15 | `3133de9` | Link anonymous site visitors to leads for pricing-page scoring. | [preview](https://connect-intel-b659y0qrt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3133de9` |

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
