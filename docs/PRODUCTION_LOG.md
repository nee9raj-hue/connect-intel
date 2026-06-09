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
npm run prod:rollback -- 4afa293
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
| Commit | `60e303d` |
| Log updated (IST) | 09/06/2026, 12:09:23 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 09/06/2026, 12:08:49 | `60e303d` | Fix Vercel deploy: remove 5-minute cron blocked on Hobby plan. | [preview](https://connect-intel-jqqodkmbf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 60e303d` | **← LIVE**
| 09/06/2026, 11:54:46 | `4afa293` | Update production log for afc084b async bulk email deploy. | [preview](https://connect-intel-6na0eilzg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4afa293` |
| 09/06/2026, 11:53:49 | `afc084b` | Queue pipeline bulk email so campaigns no longer block PostgREST. | [preview](https://connect-intel-8d8a5rl6c-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- afc084b` |
| 09/06/2026, 10:54:59 | `184bd89` | Update production log for 2e3c603 bulk email Supabase fix deploy. | [preview](https://connect-intel-inmxv1ter-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 184bd89` |
| 09/06/2026, 10:54:05 | `2e3c603` | Prevent bulk email from overloading Supabase for the whole org. | [preview](https://connect-intel-b2idi16o6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2e3c603` |
| 09/06/2026, 01:17:23 | `cebaa1c` | Update production log for 8c80060 bulk email modal and greeting deploy. | [preview](https://connect-intel-qwl3frxn4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- cebaa1c` |
| 09/06/2026, 01:16:30 | `8c80060` | Fix bulk email modal refresh loop and dashboard time greeting. | [preview](https://connect-intel-8r9ipxjp5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8c80060` |
| 09/06/2026, 01:08:48 | `4d4e084` | Update production log for 62d2db8 bulk email deploy. | [preview](https://connect-intel-4950t4ypr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4d4e084` |
| 09/06/2026, 01:07:29 | `62d2db8` | Fix bulk email recipient counts and add Marketing Hub compose tools. | [preview](https://connect-intel-ckhv4ddqx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 62d2db8` |
| 09/06/2026, 00:48:30 | `4bc40c7` | Update production log for 6ad29db segment tag layout fix deploy. | [preview](https://connect-intel-ccn7pg5j5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4bc40c7` |
| 09/06/2026, 00:47:45 | `6ad29db` | Fix segment tag picker scroll jump and blank audiences layout. | [preview](https://connect-intel-lngf42az0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6ad29db` |
| 09/06/2026, 00:39:08 | `48b515a` | Update production log for c8d12c4 smart list and tag filters deploy. | [preview](https://connect-intel-kes8q5xz9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 48b515a` |
| 09/06/2026, 00:38:22 | `c8d12c4` | Add smart list builder with tag filters and 200-contact send batches. | [preview](https://connect-intel-fnlozs59s-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c8d12c4` |
| 09/06/2026, 00:28:12 | `c49d61c` | Update production log for 2c42b51 pipeline navigation fix deploy. | [preview](https://connect-intel-t2q7vujk0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c49d61c` |
| 09/06/2026, 00:27:08 | `2c42b51` | Harden pipeline navigation history so dashboard pills do not crash the app. | [preview](https://connect-intel-b6a4g90ol-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2c42b51` |
| 09/06/2026, 00:15:29 | `b925d6f` | Apply hot-lead and follow-up filters server-side for large pipelines. | [preview](https://connect-intel-4bag17t6o-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b925d6f` |
| 09/06/2026, 00:07:02 | `2eaff40` | Fix marketing templates tab layout so marketplace renders in the hub shell. | [preview](https://connect-intel-klt89un76-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2eaff40` |
| 08/06/2026, 23:43:14 | `547d176` | Update production log for 7fc22cf My Day dashboard fix deploy. | [preview](https://connect-intel-oawco41nm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 547d176` |
| 08/06/2026, 23:42:27 | `7fc22cf` | Fix My Day command bar counts, preview drawers, and return navigation. | [preview](https://connect-intel-39fgv936i-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7fc22cf` |
| 08/06/2026, 23:29:45 | `be4bc3c` | Update production log for b376c8d Chithi V2 deploy. | [preview](https://connect-intel-kcuoyre12-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- be4bc3c` |

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
