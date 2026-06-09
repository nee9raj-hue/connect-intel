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
npm run prod:rollback -- 1cab8a6
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
| Commit | `ba43195` |
| Log updated (IST) | 10/06/2026, 00:52:49 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 10/06/2026, 00:52:37 | `ba43195` | Use pipeline_leads table for CRM saves and paginated list loads. | [preview](https://connect-intel-22q7iydd7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ba43195` | **← LIVE**
| 10/06/2026, 00:43:01 | `1cab8a6` | Update production log after CRM save performance deploy. | [preview](https://connect-intel-9x3t89i58-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1cab8a6` |
| 10/06/2026, 00:42:11 | `9b21c32` | Speed up CRM saves by deferring shard mirror and index rebuild. | [preview](https://connect-intel-i6ou1oolw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9b21c32` |
| 10/06/2026, 00:35:58 | `61e96a9` | Update production log after pipeline static batch lists deploy. | [preview](https://connect-intel-nqdkjd9a7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 61e96a9` |
| 10/06/2026, 00:35:15 | `beb7258` | Add pipeline batch static list creation from bulk selection. | [preview](https://connect-intel-96491gw77-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- beb7258` |
| 10/06/2026, 00:19:13 | `52f34e8` | Update production log after pipeline filter summary hotfix. | [preview](https://connect-intel-nqpkgx8w7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 52f34e8` |
| 10/06/2026, 00:18:26 | `e5fcb97` | Fix pipeline crash from calling join on filter summary string. | [preview](https://connect-intel-k9i8hzwxj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e5fcb97` |
| 10/06/2026, 00:17:19 | `648926e` | Update production log after Audience Studio hotfix deploy. | [preview](https://connect-intel-7i847582l-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 648926e` |
| 10/06/2026, 00:16:36 | `ab1da1f` | Fix Audience Studio crash from wrong campaign filter args. | [preview](https://connect-intel-b13yuecb3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ab1da1f` |
| 10/06/2026, 00:11:22 | `c3ede43` | Add audience P0: cached recommendations, filter save, and refresh. | [preview](https://connect-intel-oznk53i28-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c3ede43` |
| 10/06/2026, 00:00:56 | `86f07d6` | Update production log after audience-first Marketing Hub deploy. | [preview](https://connect-intel-nvd7pospr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 86f07d6` |
| 10/06/2026, 00:00:01 | `6d96f1c` | Shift Marketing Hub to audience-first workflows with Audience Studio and snapshots. | [preview](https://connect-intel-qi8ygt901-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6d96f1c` |
| 09/06/2026, 23:42:20 | `e81c6e4` | Update production log after resource protection deploy. | [preview](https://connect-intel-5783p9oq7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e81c6e4` |
| 09/06/2026, 23:41:21 | `e30d656` | Add resource protection guardrails that guide large CRM actions toward Marketing Hub. | [preview](https://connect-intel-plno4jrwz-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e30d656` |
| 09/06/2026, 23:07:20 | `a47a03a` | Cut bulk email PostgREST load with Phase A send session and deferred CRM sync. | [preview](https://connect-intel-d7ht3rway-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a47a03a` |
| 09/06/2026, 22:30:47 | `5ed3832` | Fix add-lead and bulk-assign false failures on large org pipelines. | [preview](https://connect-intel-fhdlanjwv-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5ed3832` |
| 09/06/2026, 22:24:03 | `a5e6717` | Replace bulk email banner with compact draggable send dock. | [preview](https://connect-intel-mimas86ku-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a5e6717` |
| 09/06/2026, 22:13:44 | `ef2a41f` | Improve bulk email progress UI and Railway worker deploy path. | [preview](https://connect-intel-6jmlm86yg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ef2a41f` |

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
