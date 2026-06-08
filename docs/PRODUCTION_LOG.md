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
npm run prod:rollback -- b91ead0
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
| Commit | `328295d` |
| Log updated (IST) | 08/06/2026, 17:10:01 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 08/06/2026, 17:09:30 | `328295d` | Fix AI search timeouts by querying the database before live AI. | [preview](https://connect-intel-fo1odk44n-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 328295d` | **← LIVE**
| 08/06/2026, 17:03:38 | `b91ead0` | Log production deploy c87e73e (AI search dedupe and real DB results). | [preview](https://connect-intel-e562ipxpz-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b91ead0` |
| 08/06/2026, 17:02:40 | `c87e73e` | Fix AI search showing one repeated mock lead instead of real database results. | [preview](https://connect-intel-9y3kadio0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c87e73e` |
| 08/06/2026, 16:56:08 | `e2be456` | Log production deploy 4899d0d (import timeout and dedupe fixes). | [preview](https://connect-intel-agi8927p6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e2be456` |
| 08/06/2026, 16:55:06 | `4899d0d` | Fix master DB import timeouts and add duplicate cleanup. | [preview](https://connect-intel-8btknavc4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4899d0d` |
| 08/06/2026, 16:49:58 | `4b4d3d7` | Log production deploy daa6f20 (chunked imports and operator console). | [preview](https://connect-intel-5ywngeyt9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4b4d3d7` |
| 08/06/2026, 16:48:54 | `daa6f20` | Fix large platform imports and expand operator admin console. | [preview](https://connect-intel-g49ihyidj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- daa6f20` |
| 08/06/2026, 14:42:00 | `c61fe98` | Log production deploy 8d704f3 (navigation and reporting drill-downs). | [preview](https://connect-intel-ipgy2qk9f-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c61fe98` |
| 08/06/2026, 14:40:53 | `8d704f3` | Fix navigation bugs and wire dashboard reporting drill-downs. | [preview](https://connect-intel-9imc52u6c-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8d704f3` |
| 08/06/2026, 14:06:11 | `0eecdb0` | Fix pipeline bulk email creating duplicate campaigns per batch. | [preview](https://connect-intel-phn0l8g2k-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0eecdb0` |
| 08/06/2026, 13:57:53 | `c4a59d7` | Log production deploy bd56469 (activity log dedupe fix). | [preview](https://connect-intel-1ebulsvt1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c4a59d7` |
| 08/06/2026, 13:57:02 | `bd56469` | Fix duplicate activities in log and dashboard after shard merge. | [preview](https://connect-intel-13g2yndve-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bd56469` |
| 08/06/2026, 13:53:42 | `971db3a` | Log production deploy ee67ea3 (team dashboard KPI fixes). | [preview](https://connect-intel-rb5hqbs70-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 971db3a` |
| 08/06/2026, 13:52:56 | `ee67ea3` | Fix team dashboard KPI counts and speed up intelligence loading. | [preview](https://connect-intel-gczzf8bri-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ee67ea3` |
| 08/06/2026, 13:33:31 | `1039b56` | Log production deploy 14587f4 (deal delete persistence fix). | [preview](https://connect-intel-itfd12ghx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1039b56` |
| 08/06/2026, 13:32:39 | `14587f4` | Fix deleted deals reappearing after refresh on dashboard and pipeline. | [preview](https://connect-intel-26jw26rpn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 14587f4` |
| 08/06/2026, 12:02:33 | `a8a204d` | Log production deploy 439540d (incoming call outcome). | [preview](https://connect-intel-9i4zlsbrg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a8a204d` |
| 08/06/2026, 11:59:07 | `439540d` | Add incoming call option to lead call outcome logging. | [preview](https://connect-intel-nkgsm5nff-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 439540d` |
| 08/06/2026, 11:18:45 | `4a4fad0` | Improve deals table layout and add bulk won/lost/delete actions. | [preview](https://connect-intel-3gxy07ktc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4a4fad0` |
| 08/06/2026, 11:03:18 | `db39a92` | Add delete option for deals and freight RFQs on leads. | [preview](https://connect-intel-5kemqs65k-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- db39a92` |

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
