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
npm run prod:rollback -- 9b9d254
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
| Commit | `8e209f2` |
| Log updated (IST) | 08/06/2026, 21:18:29 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 08/06/2026, 21:18:15 | `8e209f2` | Fix Marketing Domains UX when work email is already connected. | [preview](https://connect-intel-ripu2i8s5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8e209f2` | **← LIVE**
| 08/06/2026, 21:11:29 | `9b9d254` | Update production log for 03674f8 Phase 2 marketing deploy. | [preview](https://connect-intel-f2eln6kna-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9b9d254` |
| 08/06/2026, 21:10:34 | `03674f8` | Add Phase 2 marketing: canvas automations, A/B, RSS, landing pages, exports. | [preview](https://connect-intel-4rjf31tdx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 03674f8` |
| 08/06/2026, 21:02:31 | `cb3d8f6` | Update production log for 8c6ef7d email marketing deploy. | [preview](https://connect-intel-kbcvto2g4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- cb3d8f6` |
| 08/06/2026, 21:01:33 | `8c6ef7d` | Add enterprise email marketing module inside CRM Marketing. | [preview](https://connect-intel-n568uqi1i-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8c6ef7d` |
| 08/06/2026, 20:45:49 | `c16f247` | Update production log for ad3855c kanban bulk email fix deploy. | [preview](https://connect-intel-l6xuupsz1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c16f247` |
| 08/06/2026, 20:45:05 | `ad3855c` | Fix bulk email button for kanban selections on large pipelines. | [preview](https://connect-intel-c98uvv1jm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ad3855c` |
| 08/06/2026, 20:33:37 | `3645ff3` | Update production log for 968ad4f bulk email deploy. | [preview](https://connect-intel-ivcz2mmc6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3645ff3` |
| 08/06/2026, 20:32:51 | `968ad4f` | Improve pipeline bulk email for up to 200 leads with parallel sends and resume. | [preview](https://connect-intel-nn2lxuhmn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 968ad4f` |
| 08/06/2026, 20:25:11 | `093bab2` | Update production log for 98298dc timezone and Monday week deploy. | [preview](https://connect-intel-1o2gxsbeb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 093bab2` |
| 08/06/2026, 20:24:27 | `98298dc` | Use Monday-based calendar weeks and local timezone for periods and dates. | [preview](https://connect-intel-mb53ve6j6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 98298dc` |
| 08/06/2026, 20:16:09 | `d810ae7` | Update production log for 455806b activity pagination deploy. | [preview](https://connect-intel-3nxlepyay-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d810ae7` |
| 08/06/2026, 20:15:21 | `455806b` | Paginate Team Intelligence detailed activity to five rows with load more. | [preview](https://connect-intel-kwinca27d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 455806b` |
| 08/06/2026, 20:05:56 | `925bced` | Update production log for b3a9f3b Team Intelligence upgrade deploy. | [preview](https://connect-intel-mwbftfxs4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 925bced` |
| 08/06/2026, 20:05:03 | `b3a9f3b` | Upgrade Team Intelligence with filter counts, roster selection, and activity detail modals. | [preview](https://connect-intel-3jifbmn2c-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b3a9f3b` |
| 08/06/2026, 19:48:42 | `3a03a29` | Add full Team Intelligence page for manager rep reviews. | [preview](https://connect-intel-6wqix7pis-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3a03a29` |
| 08/06/2026, 19:34:52 | `fb040ab` | Speed up CRM load with precomputed pipeline index and bootstrap API. | [preview](https://connect-intel-hshadiqob-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- fb040ab` |
| 08/06/2026, 19:18:31 | `8d39bf2` | Fix Ludhiana textile search: ignore india keyword, restore live AI fallback. | [preview](https://connect-intel-38gtiwjs3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8d39bf2` |
| 08/06/2026, 19:11:19 | `251c96d` | Fix search timeout by avoiding full-store quota reads/writes. | [preview](https://connect-intel-7vl9u70bk-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 251c96d` |
| 08/06/2026, 17:10:29 | `7584d6b` | Log production deploy 328295d (AI search database-first). | [preview](https://connect-intel-kamnnmsfn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7584d6b` |

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
