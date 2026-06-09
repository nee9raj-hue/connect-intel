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
npm run prod:rollback -- 86f07d6
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
| Commit | `c3ede43` |
| Log updated (IST) | 10/06/2026, 00:11:35 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 10/06/2026, 00:11:22 | `c3ede43` | Add audience P0: cached recommendations, filter save, and refresh. | [preview](https://connect-intel-oznk53i28-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c3ede43` | **← LIVE**
| 10/06/2026, 00:00:56 | `86f07d6` | Update production log after audience-first Marketing Hub deploy. | [preview](https://connect-intel-nvd7pospr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 86f07d6` |
| 10/06/2026, 00:00:01 | `6d96f1c` | Shift Marketing Hub to audience-first workflows with Audience Studio and snapshots. | [preview](https://connect-intel-qi8ygt901-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6d96f1c` |
| 09/06/2026, 23:42:20 | `e81c6e4` | Update production log after resource protection deploy. | [preview](https://connect-intel-5783p9oq7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e81c6e4` |
| 09/06/2026, 23:41:21 | `e30d656` | Add resource protection guardrails that guide large CRM actions toward Marketing Hub. | [preview](https://connect-intel-plno4jrwz-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e30d656` |
| 09/06/2026, 23:07:20 | `a47a03a` | Cut bulk email PostgREST load with Phase A send session and deferred CRM sync. | [preview](https://connect-intel-d7ht3rway-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a47a03a` |
| 09/06/2026, 22:30:47 | `5ed3832` | Fix add-lead and bulk-assign false failures on large org pipelines. | [preview](https://connect-intel-fhdlanjwv-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5ed3832` |
| 09/06/2026, 22:24:03 | `a5e6717` | Replace bulk email banner with compact draggable send dock. | [preview](https://connect-intel-mimas86ku-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a5e6717` |
| 09/06/2026, 22:13:44 | `ef2a41f` | Improve bulk email progress UI and Railway worker deploy path. | [preview](https://connect-intel-6jmlm86yg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ef2a41f` |
| 09/06/2026, 21:54:00 | `1306aba` | Implement dual-mode email: inline ≤10, queue+worker for bulk. | [preview](https://connect-intel-6i7valyeo-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1306aba` |
| 09/06/2026, 21:02:43 | `609847f` | Send pipeline and marketing emails inline on queue — no worker required. | [preview](https://connect-intel-4617bvvzx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 609847f` |
| 09/06/2026, 20:55:01 | `595f20e` | Keep bulk email progress visible after the send popup closes. | [preview](https://connect-intel-j9k2jnuax-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 595f20e` |
| 09/06/2026, 20:46:24 | `25e4065` | Route legacy bulk email requests to background queue under Email V3. | [preview](https://connect-intel-q1sy9i6t0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 25e4065` |

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
