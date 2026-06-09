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
npm run prod:rollback -- a535741
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
| Commit | `6de7d78` |
| Log updated (IST) | 09/06/2026, 16:10:22 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 09/06/2026, 15:37:59 | `6de7d78` | Fix dashboard crash and restore team intelligence when snapshots are cold. | [preview](https://connect-intel-2m24mi7jj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6de7d78` | **← LIVE**
| 09/06/2026, 15:27:45 | `a535741` | Refactor dashboard to snapshot-first cache architecture. | [preview](https://connect-intel-nt4ya0l3v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a535741` |
| 09/06/2026, 13:02:20 | `33ebee0` | Add platform hardening for production CRM scale. | [preview](https://connect-intel-9t737d5zo-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 33ebee0` |
| 09/06/2026, 12:30:28 | `4ccdf6f` | Update production log for 21e1d2b Email Infrastructure V2 deploy. | [preview](https://connect-intel-3fywpwh5x-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4ccdf6f` |
| 09/06/2026, 12:29:12 | `21e1d2b` | Add Email Infrastructure V2 for background campaign sending. | [preview](https://connect-intel-hnbphdgbm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 21e1d2b` |
| 09/06/2026, 12:16:40 | `a67c195` | Update production log for e9b3f81 event-driven queue drain deploy. | [preview](https://connect-intel-j7f1h7m93-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a67c195` |
| 09/06/2026, 12:15:35 | `e9b3f81` | Trigger queue drain on enqueue so email does not depend on Vercel cron. | [preview](https://connect-intel-gr88xgs9z-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e9b3f81` |
| 09/06/2026, 12:09:59 | `15148f3` | Update production log for 60e303d infrastructure foundation deploy. | [preview](https://connect-intel-68p8rx983-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 15148f3` |
| 09/06/2026, 12:08:49 | `60e303d` | Fix Vercel deploy: remove 5-minute cron blocked on Hobby plan. | [preview](https://connect-intel-jqqodkmbf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 60e303d` |
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
