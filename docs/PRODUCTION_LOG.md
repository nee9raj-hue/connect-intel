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
npm run prod:rollback -- 88e6235
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
| Commit | `647399a` |
| Log updated (IST) | 18/09/2026, 16:21:36 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 18/09/2026, 16:20:43 | `647399a` | Keep sign-in from waiting on ERP owner claim. | [preview](https://connect-intel-8rygofcur-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 647399a` | **← LIVE**
| 18/09/2026, 16:13:20 | `88e6235` | Record production LIVE snapshot for pipeline timeout fix. | [preview](https://connect-intel-7ywivhl87-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 88e6235` |
| 18/09/2026, 16:12:03 | `4bdbdf1` | Stop Pipeline from waiting on ERP owner claim. | [preview](https://connect-intel-6u8onp3vh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4bdbdf1` |
| 18/09/2026, 15:58:23 | `593dbc7` | Record production LIVE snapshot for 8cb0b10. | [preview](https://connect-intel-gmscbauw3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 593dbc7` |
| 18/09/2026, 14:59:42 | `8cb0b10` | Record production LIVE snapshot for ERP owner reclaim. | [preview](https://connect-intel-bgl5s3wxy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8cb0b10` |
| 18/09/2026, 14:57:28 | `ce5fb85` | Assign CRM owners from ERP sales owner and reclaim unmatched books. | [preview](https://connect-intel-v2hhu6tj3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ce5fb85` |
| 18/09/2026, 13:03:33 | `2aaba95` | Record production LIVE snapshot for ERP customer-service overlay sync. | [preview](https://connect-intel-eeijfld84-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2aaba95` |
| 18/09/2026, 13:02:15 | `3f46a72` | Schedule the ERP customer sync daily so Vercel Hobby will accept the deploy. | [preview](https://connect-intel-nl2hq933v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3f46a72` |
| 18/09/2026, 00:41:07 | `677f15f` | Record production LIVE snapshot for 0c81265. | [preview](https://connect-intel-ro9zc2nz3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 677f15f` |
| 18/09/2026, 00:16:44 | `0c81265` | Record production LIVE snapshot after the overlay-matching log commit reached Vercel. | [preview](https://connect-intel-kzx4ihv6g-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0c81265` |
| 18/09/2026, 00:10:04 | `a9a77b2` | Record production LIVE snapshot for ERP last-shipment overlay matching. | [preview](https://connect-intel-ofc961ktg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a9a77b2` |
| 18/09/2026, 00:07:41 | `0adbbf3` | Stamp Xindus ERP last-shipment onto leads that missed overlay match so idle accounts like XLP leave New Account. | [preview](https://connect-intel-bo5ndkmtz-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0adbbf3` |
| 17/09/2026, 23:52:32 | `5472a90` | Record production LIVE snapshot for ERP restage and permission-gated nav. | [preview](https://connect-intel-6uxgqv1to-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5472a90` |
| 17/09/2026, 23:51:13 | `0eb0d66` | Restage ERP accounts from first and last shipment, match short names like XLP, and hide sidebar items a role cannot use. | [preview](https://connect-intel-4tupl63g9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0eb0d66` |
| 17/09/2026, 22:59:47 | `632a41d` | Record production LIVE snapshot for Unique customers list removal. | [preview](https://connect-intel-c56rmof8a-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 632a41d` |
| 17/09/2026, 22:58:32 | `a6c9bed` | Remove the Unique customers owner list from Home so the dashboard only shows period totals. | [preview](https://connect-intel-m3fonbipr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a6c9bed` |
| 17/09/2026, 22:44:49 | `2430f9f` | Record production LIVE snapshot for Home dashboard ERP shipment facts. | [preview](https://connect-intel-a07iz3ljh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2430f9f` |
| 17/09/2026, 22:43:23 | `d2ff4e4` | Fill Home dashboard widgets from ERP shipment dates and match overlay rows that the pipeline missed. | [preview](https://connect-intel-4a0astmas-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d2ff4e4` |
| 17/09/2026, 22:30:19 | `8ea23ee` | Record production LIVE snapshot for team pipeline sharing and locked rep nav. | [preview](https://connect-intel-nnmhkf26q-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8ea23ee` |

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
