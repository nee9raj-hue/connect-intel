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
npm run prod:rollback -- 32288b9
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
| Commit | `eeec0da` |
| Log updated (IST) | 11/06/2026, 22:25:14 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 11/06/2026, 22:24:58 | `eeec0da` | fix: pipeline filter toolbar popups with owner filter and Esc support | [preview](https://connect-intel-1ta6oncjm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- eeec0da` | **← LIVE**
| 11/06/2026, 22:16:31 | `32288b9` | chore: production log after marketing pipeline drill-down deploy | [preview](https://connect-intel-dnde73g2o-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 32288b9` |
| 11/06/2026, 22:15:58 | `1ea89a3` | fix: restore intentional dark left sidebar chrome | [preview](https://connect-intel-pijs795kz-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1ea89a3` |
| 11/06/2026, 22:15:25 | `6812480` | fix: marketing campaign reports drill to filtered pipeline with accurate stats | [preview](https://connect-intel-mwszfe8nl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6812480` |
| 11/06/2026, 21:58:54 | `95bc78c` | chore: production log after brand color theme deploy | [preview](https://connect-intel-4f2rjuru6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 95bc78c` |
| 11/06/2026, 21:58:06 | `90a26a5` | style: unify app UI to orange and slate brand colors | [preview](https://connect-intel-oeg92ksxp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 90a26a5` |
| 11/06/2026, 21:51:53 | `1c36138` | chore: production log after pipeline hover and filter fixes deploy | [preview](https://connect-intel-5t8k9sado-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1c36138` |
| 11/06/2026, 21:50:56 | `599c342` | fix: pipeline hover actions, HubSpot filters, and comma name search | [preview](https://connect-intel-fxce4uln8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 599c342` |
| 11/06/2026, 21:35:01 | `1395be7` | chore: production log after pipeline list stability deploy | [preview](https://connect-intel-9ojcex78r-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1395be7` |
| 11/06/2026, 21:34:02 | `d439ffa` | fix: stabilize pipeline list, restore hover actions and tags | [preview](https://connect-intel-9yv36uu5q-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d439ffa` |
| 11/06/2026, 21:21:11 | `4a041dc` | chore: production log after pipeline avatar color fix | [preview](https://connect-intel-ebjr8k2u6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4a041dc` |
| 11/06/2026, 21:20:07 | `4459d66` | fix: restore orange pipeline name initials on list avatars | [preview](https://connect-intel-98h4b6264-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4459d66` |
| 11/06/2026, 21:11:35 | `8b67951` | chore: production log after pipeline color revert deploy | [preview](https://connect-intel-jn9eveyfb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8b67951` |
| 11/06/2026, 21:10:29 | `4add1de` | fix: revert pipeline brand colors and repair list table UI | [preview](https://connect-intel-op6sau9ev-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4add1de` |
| 11/06/2026, 20:53:26 | `be87909` | chore: production log after pipeline list polish deploy | [preview](https://connect-intel-m9j1mzzfj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- be87909` |
| 11/06/2026, 20:51:48 | `339ec1e` | feat: pipeline list polish with brand tokens and board UX | [preview](https://connect-intel-6lxd7t1x9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 339ec1e` |
| 11/06/2026, 13:14:45 | `5a8c263` | chore: production log after marketing pipeline drill-down deploy | [preview](https://connect-intel-ezysxu8ci-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5a8c263` |
| 11/06/2026, 13:13:00 | `4e94f86` | feat: marketing campaign metrics drill down to filtered pipeline | [preview](https://connect-intel-o5w3wsj8v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4e94f86` |
| 11/06/2026, 12:53:50 | `b92be6e` | chore: production log after dashboard filter drill-down deploy | [preview](https://connect-intel-cvpgxqe4j-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b92be6e` |
| 11/06/2026, 12:52:51 | `c78111f` | fix: wire dashboard drill-downs to filtered pipeline views and speed up bootstrap | [preview](https://connect-intel-fxbpsqecl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c78111f` |

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
