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
npm run prod:rollback -- 08438c3
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
| Commit | `828834a` |
| Log updated (IST) | 18/09/2026, 23:11:21 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 18/09/2026, 23:09:45 | `828834a` | Filter pipeline by team members like tags, not stale lead team_id. | [preview](https://connect-intel-rj066g5bi-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 828834a` | **← LIVE**
| 18/09/2026, 22:23:32 | `08438c3` | Record production LIVE snapshot for ERP owner reset remap. | [preview](https://connect-intel-btd5xnjp0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 08438c3` |
| 18/09/2026, 22:14:58 | `0f83385` | Reset ERP dump owners on existing Xindus leads without deleting deals. | [preview](https://connect-intel-4h0eot52s-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0f83385` |
| 18/09/2026, 22:05:55 | `554f204` | Record production LIVE snapshot for ERP ops-list owner mapping. | [preview](https://connect-intel-kt95r2868-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 554f204` |
| 18/09/2026, 22:04:28 | `6590bef` | Assign CRM sales owners from the ERP ops customer list, not the Metabase dump. | [preview](https://connect-intel-3mvzxim5e-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6590bef` |
| 18/09/2026, 16:38:27 | `1e08615` | Record production LIVE snapshot for fast sign-in. | [preview](https://connect-intel-1g4rm4e0j-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1e08615` |
| 18/09/2026, 16:37:33 | `7b93347` | Return a session without writing the user store on sign-in. | [preview](https://connect-intel-n6ox6pkaw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7b93347` |
| 18/09/2026, 16:30:41 | `eab4736` | Record production LIVE snapshot for sign-in store-read fix. | [preview](https://connect-intel-q9quk1ajq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- eab4736` |
| 18/09/2026, 16:29:47 | `31b8b77` | Stop email sign-in from loading the entire CRM store. | [preview](https://connect-intel-ocnwpar34-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 31b8b77` |
| 18/09/2026, 16:22:20 | `4b3682c` | Record production LIVE snapshot for sign-in timeout fix. | [preview](https://connect-intel-lalaxie9t-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4b3682c` |
| 18/09/2026, 16:20:43 | `647399a` | Keep sign-in from waiting on ERP owner claim. | [preview](https://connect-intel-8rygofcur-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 647399a` |
| 18/09/2026, 16:13:20 | `88e6235` | Record production LIVE snapshot for pipeline timeout fix. | [preview](https://connect-intel-7ywivhl87-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 88e6235` |
| 18/09/2026, 16:12:03 | `4bdbdf1` | Stop Pipeline from waiting on ERP owner claim. | [preview](https://connect-intel-6u8onp3vh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4bdbdf1` |
| 18/09/2026, 15:58:23 | `593dbc7` | Record production LIVE snapshot for 8cb0b10. | [preview](https://connect-intel-gmscbauw3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 593dbc7` |
| 18/09/2026, 14:59:42 | `8cb0b10` | Record production LIVE snapshot for ERP owner reclaim. | [preview](https://connect-intel-bgl5s3wxy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8cb0b10` |
| 18/09/2026, 14:57:28 | `ce5fb85` | Assign CRM owners from ERP sales owner and reclaim unmatched books. | [preview](https://connect-intel-v2hhu6tj3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ce5fb85` |
| 18/09/2026, 13:03:33 | `2aaba95` | Record production LIVE snapshot for ERP customer-service overlay sync. | [preview](https://connect-intel-eeijfld84-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2aaba95` |
| 18/09/2026, 13:02:15 | `3f46a72` | Schedule the ERP customer sync daily so Vercel Hobby will accept the deploy. | [preview](https://connect-intel-nl2hq933v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3f46a72` |
| 18/09/2026, 00:41:07 | `677f15f` | Record production LIVE snapshot for 0c81265. | [preview](https://connect-intel-ro9zc2nz3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 677f15f` |

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
