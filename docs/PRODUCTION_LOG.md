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
npm run prod:rollback -- 6bf2234
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
| Commit | `b2a6279` |
| Log updated (IST) | 19/09/2026, 18:48:04 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 19/09/2026, 18:47:08 | `b2a6279` | Revert 2780b65 and every commit after it. | [preview](https://connect-intel-2rio7cavx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b2a6279` | **← LIVE**
| 19/09/2026, 18:29:24 | `6bf2234` | Record production LIVE snapshot for pipeline-index timeout fix. | [preview](https://connect-intel-kcbonvaza-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6bf2234` |
| 19/09/2026, 18:27:59 | `afe217a` | Stop Team and Pipeline from waiting on the pipeline-index blob. | [preview](https://connect-intel-ox1lbea53-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- afe217a` |
| 19/09/2026, 18:21:12 | `f4666a3` | Record production LIVE snapshot for 2a1fb30. | [preview](https://connect-intel-1a0j01l0e-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f4666a3` |
| 19/09/2026, 18:19:48 | `2a1fb30` | Record production LIVE snapshot for ERP overlay Team/Pipeline recovery. | [preview](https://connect-intel-nzfi63t3l-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2a1fb30` |
| 19/09/2026, 18:18:05 | `af9adb1` | Keep Team, CRM tags, and Pipeline off the users blob during ERP overlay. | [preview](https://connect-intel-dtz9qqe9x-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- af9adb1` |
| 19/09/2026, 17:59:11 | `368a69b` | Load company Pipeline from SQL using the session, not the users blob. | [preview](https://connect-intel-lo1xejrpl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 368a69b` |
| 19/09/2026, 17:42:26 | `df1e6a8` | Count Xindus ERP cron handlers as cron-gated in the RBAC audit. | [preview](https://connect-intel-ksgvfw9nu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- df1e6a8` |
| 19/09/2026, 17:40:02 | `aaec16a` | Record production LIVE snapshot for crm.xindus.net sign-in fix. | [preview](https://connect-intel-51xd632yr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- aaec16a` |
| 19/09/2026, 17:33:51 | `ab66375` | Stop sign-in from downloading the users blob and fix crm.xindus.net cookies. | [preview](https://connect-intel-nhkpfztd2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ab66375` |
| 19/09/2026, 17:14:23 | `c448392` | Stop team roster downloads from emptying Pipeline on timeout. | [preview](https://connect-intel-i2lo8d9kp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c448392` |
| 19/09/2026, 17:03:48 | `0345bc7` | Allow login and signup without a mobile number. | [preview](https://connect-intel-nn3a9dz0k-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0345bc7` |
| 19/09/2026, 16:53:38 | `2eef4ff` | Keep Pipeline opening when Supabase is slow instead of blocking sign-in. | [preview](https://connect-intel-36h6w0vol-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2eef4ff` |
| 19/09/2026, 16:35:22 | `2780b65` | Split freight Pipeline into CRM/ERP tracks and show read-only ERP tag chips. | [preview](https://connect-intel-ob3ij2wm0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2780b65` |
| 19/09/2026, 15:08:25 | `72585b6` | Record production LIVE snapshot for left-nav hover flyouts. | [preview](https://connect-intel-r0pypltqx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 72585b6` |
| 19/09/2026, 15:07:22 | `91006a3` | Open left-nav submenus as right hover popups and promote Deals. | [preview](https://connect-intel-7zh5t28vl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 91006a3` |
| 19/09/2026, 14:41:21 | `7179687` | Record production LIVE snapshot for deals list timeout fix. | [preview](https://connect-intel-7c8s726gf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7179687` |
| 19/09/2026, 14:40:05 | `9c66a9d` | Restore Deals list-only and stop downloading the full deals table. | [preview](https://connect-intel-q2g9z3oor-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9c66a9d` |
| 19/09/2026, 14:22:44 | `5b4c1a2` | Record production LIVE snapshot for deals board/list toggle. | [preview](https://connect-intel-2vjc1ptky-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5b4c1a2` |
| 19/09/2026, 14:21:21 | `49315cf` | Put Deals board/list toggle in the page header where Pipeline already shows it. | [preview](https://connect-intel-gkk4pgo4f-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 49315cf` |

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
