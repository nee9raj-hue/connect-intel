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
npm run prod:rollback -- d810ae7
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
| Commit | `98298dc` |
| Log updated (IST) | 08/06/2026, 20:24:40 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 08/06/2026, 20:24:27 | `98298dc` | Use Monday-based calendar weeks and local timezone for periods and dates. | [preview](https://connect-intel-mb53ve6j6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 98298dc` | **← LIVE**
| 08/06/2026, 20:16:09 | `d810ae7` | Update production log for 455806b activity pagination deploy. | [preview](https://connect-intel-3nxlepyay-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d810ae7` |
| 08/06/2026, 20:15:21 | `455806b` | Paginate Team Intelligence detailed activity to five rows with load more. | [preview](https://connect-intel-kwinca27d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 455806b` |
| 08/06/2026, 20:05:56 | `925bced` | Update production log for b3a9f3b Team Intelligence upgrade deploy. | [preview](https://connect-intel-mwbftfxs4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 925bced` |
| 08/06/2026, 20:05:03 | `b3a9f3b` | Upgrade Team Intelligence with filter counts, roster selection, and activity detail modals. | [preview](https://connect-intel-3jifbmn2c-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b3a9f3b` |
| 08/06/2026, 19:48:42 | `3a03a29` | Add full Team Intelligence page for manager rep reviews. | [preview](https://connect-intel-6wqix7pis-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3a03a29` |
| 08/06/2026, 19:34:52 | `fb040ab` | Speed up CRM load with precomputed pipeline index and bootstrap API. | [preview](https://connect-intel-hshadiqob-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- fb040ab` |
| 08/06/2026, 19:18:31 | `8d39bf2` | Fix Ludhiana textile search: ignore india keyword, restore live AI fallback. | [preview](https://connect-intel-38gtiwjs3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8d39bf2` |
| 08/06/2026, 19:11:19 | `251c96d` | Fix search timeout by avoiding full-store quota reads/writes. | [preview](https://connect-intel-7vl9u70bk-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 251c96d` |
| 08/06/2026, 17:10:29 | `7584d6b` | Log production deploy 328295d (AI search database-first). | [preview](https://connect-intel-kamnnmsfn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7584d6b` |
| 08/06/2026, 17:09:30 | `328295d` | Fix AI search timeouts by querying the database before live AI. | [preview](https://connect-intel-fo1odk44n-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 328295d` |
| 08/06/2026, 17:03:38 | `b91ead0` | Log production deploy c87e73e (AI search dedupe and real DB results). | [preview](https://connect-intel-e562ipxpz-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b91ead0` |
| 08/06/2026, 17:02:40 | `c87e73e` | Fix AI search showing one repeated mock lead instead of real database results. | [preview](https://connect-intel-9y3kadio0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c87e73e` |
| 08/06/2026, 16:56:08 | `e2be456` | Log production deploy 4899d0d (import timeout and dedupe fixes). | [preview](https://connect-intel-agi8927p6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e2be456` |
| 08/06/2026, 16:55:06 | `4899d0d` | Fix master DB import timeouts and add duplicate cleanup. | [preview](https://connect-intel-8btknavc4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4899d0d` |
| 08/06/2026, 16:49:58 | `4b4d3d7` | Log production deploy daa6f20 (chunked imports and operator console). | [preview](https://connect-intel-5ywngeyt9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4b4d3d7` |
| 08/06/2026, 16:48:54 | `daa6f20` | Fix large platform imports and expand operator admin console. | [preview](https://connect-intel-g49ihyidj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- daa6f20` |
| 08/06/2026, 14:42:00 | `c61fe98` | Log production deploy 8d704f3 (navigation and reporting drill-downs). | [preview](https://connect-intel-ipgy2qk9f-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c61fe98` |
| 08/06/2026, 14:40:53 | `8d704f3` | Fix navigation bugs and wire dashboard reporting drill-downs. | [preview](https://connect-intel-9imc52u6c-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8d704f3` |
| 08/06/2026, 14:06:11 | `0eecdb0` | Fix pipeline bulk email creating duplicate campaigns per batch. | [preview](https://connect-intel-phn0l8g2k-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0eecdb0` |

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
