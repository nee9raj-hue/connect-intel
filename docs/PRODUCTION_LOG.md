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
npm run prod:rollback -- 12d5196
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
| Commit | `240e589` |
| Log updated (IST) | 08/06/2026, 21:37:40 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 08/06/2026, 21:37:26 | `240e589` | Add CRM Phase 1: companies hub, pipelines, workflows, timeline, scoring. | [preview](https://connect-intel-2rc6mym8v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 240e589` | **← LIVE**
| 08/06/2026, 21:32:39 | `12d5196` | Update production log for bfc34d4 CRM platform Phase 0 deploy. | [preview](https://connect-intel-7pmalo07t-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 12d5196` |
| 08/06/2026, 21:31:50 | `bfc34d4` | Add CRM platform Phase 0: blueprint, command palette, and unified search. | [preview](https://connect-intel-3wdssc8c9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bfc34d4` |
| 08/06/2026, 21:19:00 | `789ff50` | Update production log for 8e209f2 Marketing Domains UX fix. | [preview](https://connect-intel-hy8y9pdez-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 789ff50` |
| 08/06/2026, 21:18:15 | `8e209f2` | Fix Marketing Domains UX when work email is already connected. | [preview](https://connect-intel-ripu2i8s5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8e209f2` |
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
