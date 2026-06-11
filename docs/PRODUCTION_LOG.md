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
npm run prod:rollback -- cf5c8fa
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
| Commit | `6951eb2` |
| Log updated (IST) | 11/06/2026, 12:32:40 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 11/06/2026, 12:32:29 | `6951eb2` | feat: rebuild home dashboard with role-aware bootstrap API and indigo v4 UI | [preview](https://connect-intel-97vtz0e7v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6951eb2` | **← LIVE**
| 11/06/2026, 12:17:17 | `cf5c8fa` | chore: production log after Manager team scope fix deploy | [preview](https://connect-intel-6o9cmfc2r-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- cf5c8fa` |
| 11/06/2026, 12:16:18 | `79b554b` | fix: scope Manager pipeline visibility to their team only | [preview](https://connect-intel-4bxsry3tt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 79b554b` |
| 10/06/2026, 17:46:15 | `e89345d` | chore: production log after Team members tab fix deploy | [preview](https://connect-intel-od495iml7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e89345d` |
| 10/06/2026, 17:45:14 | `39bbe33` | fix: import useEffect in TeamMembersTab to stop Team members crash | [preview](https://connect-intel-h6svnc1tt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 39bbe33` |
| 10/06/2026, 17:43:03 | `c625be4` | chore: production log after Marketing Hub performance fix deploy | [preview](https://connect-intel-q9s84lmta-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c625be4` |
| 10/06/2026, 17:41:52 | `e569c84` | fix: Marketing Hub timeouts, reports, overview data, and bulk email manual entry | [preview](https://connect-intel-pbsp0kiuh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e569c84` |
| 10/06/2026, 17:25:23 | `39e86d9` | chore: production log after Marketing Hub deploy | [preview](https://connect-intel-ag600twcn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 39e86d9` |
| 10/06/2026, 17:24:30 | `281694a` | Rebuild Marketing Hub with indigo v3 UI and new APIs. | [preview](https://connect-intel-g8drpaq1a-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 281694a` |
| 10/06/2026, 16:56:32 | `9ae193f` | chore: production log after useEffect fix deploy | [preview](https://connect-intel-kyqg17mym-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9ae193f` |
| 10/06/2026, 16:55:15 | `1be5e79` | fix: import useEffect in TeamMembersTab to stop runtime crash | [preview](https://connect-intel-cnecxk3z8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1be5e79` |
| 10/06/2026, 16:48:46 | `0fad84b` | Update production log after team hierarchy fix deploy. | [preview](https://connect-intel-4iz84gtqb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0fad84b` |
| 10/06/2026, 16:48:00 | `db3b924` | Fix team hierarchy assignment and speed up settings loads. | [preview](https://connect-intel-6th7nwwei-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- db3b924` |
| 10/06/2026, 16:34:35 | `38357bc` | Update production log after settings hub deploy. | [preview](https://connect-intel-224pgdf4j-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 38357bc` |
| 10/06/2026, 16:33:49 | `517219f` | Rebuild Team settings as HubSpot-style tabbed admin hub. | [preview](https://connect-intel-d8kf35eny-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 517219f` |
| 10/06/2026, 16:19:29 | `bf41817` | Update production log after departments nav deploy. | [preview](https://connect-intel-5qualwjb6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bf41817` |
| 10/06/2026, 16:18:34 | `7059942` | Surface Departments & teams in sidebar with URL deep links. | [preview](https://connect-intel-1sokgx894-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7059942` |
| 10/06/2026, 16:13:28 | `ea59b80` | Polish Org Admin: member roles, moves, deactivate, and import stats. | [preview](https://connect-intel-fduehr25f-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ea59b80` |
| 10/06/2026, 16:09:01 | `0349be6` | Add Org Admin hub with departments, teams, and permissions matrix. | [preview](https://connect-intel-bdrik1uy9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0349be6` |
| 10/06/2026, 16:01:47 | `e7961d6` | Add pipeline keyset pagination and Sprint 1 performance reliability. | [preview](https://connect-intel-aozpg6zbp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e7961d6` |

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
