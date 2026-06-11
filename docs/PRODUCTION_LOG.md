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
npm run prod:rollback -- 4a8d8a8
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
| Commit | `d8e12ad` |
| Log updated (IST) | 12/06/2026, 02:03:13 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 12/06/2026, 02:03:12 | `d8e12ad` | fix: calendar sync toolbar, mobile drawer portal, and immersive chrome | [preview](https://connect-intel-96kx93h4v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d8e12ad` | **← LIVE**
| 12/06/2026, 01:56:40 | `4a8d8a8` | feat: team-wide unassigned leads pool with self-claim | [preview](https://connect-intel-pquf1y5mb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4a8d8a8` |
| 12/06/2026, 01:52:47 | `da088f2` | feat: Google Calendar-style mobile layout and minimal sync floater | [preview](https://connect-intel-2frwzb4rz-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- da088f2` |
| 12/06/2026, 01:48:52 | `0e2a9da` | fix: align month calendar cells and clip event pills | [preview](https://connect-intel-k210zfyrf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0e2a9da` |
| 12/06/2026, 01:32:05 | `30baa07` | perf: speed up CRM calendar load for large pipelines | [preview](https://connect-intel-5v8u3uepj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 30baa07` |
| 12/06/2026, 01:29:24 | `2afbb2f` | fix: restore pipeline scroll and pin compact load-more bar to bottom | [preview](https://connect-intel-aut68tkh8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2afbb2f` |
| 12/06/2026, 01:24:28 | `b664332` | feat: redesign CRM calendar with Google Calendar-style UI | [preview](https://connect-intel-einidhnn1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b664332` |
| 12/06/2026, 01:12:56 | `1a9fc07` | fix: pipeline list uses single overflow scroll for vertical and horizontal | [preview](https://connect-intel-jftpu1kjl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1a9fc07` |
| 12/06/2026, 00:57:15 | `06b754d` | fix: stop pipeline table jitter with fixed hover action slots | [preview](https://connect-intel-291rje1t8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 06b754d` |
| 12/06/2026, 00:53:41 | `6e4c119` | fix: pipeline row hover uses color-only changes without layout jitter | [preview](https://connect-intel-96ea8cu1n-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6e4c119` |
| 12/06/2026, 00:43:58 | `cb2557d` | feat: pipeline city, state, and tags as separate table columns | [preview](https://connect-intel-5jqyz3sr8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- cb2557d` |
| 12/06/2026, 00:36:19 | `a92da9a` | fix: pipeline owner filter matches assignee and saved-by owner fields | [preview](https://connect-intel-doe6exghb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a92da9a` |
| 12/06/2026, 00:21:29 | `57c5c0d` | fix: stop bulk email timeouts by avoiding marketingCampaigns blob loads | [preview](https://connect-intel-br1wuw42a-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 57c5c0d` |
| 12/06/2026, 00:14:21 | `b6d25d8` | fix: bulk email queue timeouts and pipeline column reorder | [preview](https://connect-intel-8kya5wuxm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b6d25d8` |
| 11/06/2026, 23:58:01 | `27f7bd2` | feat: toggle pipeline row hover quick actions in view settings | [preview](https://connect-intel-ptzj3a2wq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 27f7bd2` |
| 11/06/2026, 23:51:19 | `11d3945` | fix: populate city/state filter options from full pipeline index | [preview](https://connect-intel-2ovxfwklo-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 11d3945` |
| 11/06/2026, 23:44:19 | `d919172` | fix: exact city/state pipeline filters with location parsing | [preview](https://connect-intel-3d5477zio-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d919172` |
| 11/06/2026, 23:26:34 | `51bc36f` | fix: pipeline top bulk bar and mobile list scroll | [preview](https://connect-intel-1rjb9udyr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 51bc36f` |
| 11/06/2026, 23:13:26 | `e55951f` | fix: align home dashboard colors with activity log page | [preview](https://connect-intel-gmfuk7a4p-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e55951f` |
| 11/06/2026, 23:05:08 | `b95eed2` | fix: keep pipeline row hover actions on screen | [preview](https://connect-intel-b6dgd7a0l-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b95eed2` |

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
