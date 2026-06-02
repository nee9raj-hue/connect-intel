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
npm run prod:rollback -- 6512225
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
| Commit | `dfec7e6` |
| Log updated (IST) | 02/06/2026, 13:42:31 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 02/06/2026, 13:42:08 | `dfec7e6` | Improve campaign/template canvas scrolling and rail usability. | [preview](https://connect-intel-4u0n2knkv-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- dfec7e6` | **← LIVE**
| 01/06/2026, 12:46:43 | `6512225` | chore: sync production log after 44a2b25 deploy. | [preview](https://connect-intel-cdpy8t7fa-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6512225` |
| 01/06/2026, 12:45:58 | `44a2b25` | Speed up pipeline lead assignment after shard PATCH fix. | [preview](https://connect-intel-5fckfc67e-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 44a2b25` |
| 01/06/2026, 12:39:14 | `46ef252` | Update production log after pipeline timeout fix deploy. | [preview](https://connect-intel-3ngx2syyf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 46ef252` |
| 01/06/2026, 12:38:02 | `969c39a` | Fix pipeline assign and status PATCH timeouts. | [preview](https://connect-intel-ki3rwfh1x-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 969c39a` |
| 30/05/2026, 22:12:24 | `59e7741` | Use free OSRM/Nominatim for field visit distance suggestions. | [preview](https://connect-intel-60y8n500c-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 59e7741` |
| 30/05/2026, 22:08:15 | `cb243f6` | Add field visit edit and Google distance suggestions. | [preview](https://connect-intel-blu484925-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- cb243f6` |
| 30/05/2026, 21:53:21 | `e3e18b0` | Add field visit travel claims with expenses page (Phase 1+2). | [preview](https://connect-intel-5filgp18r-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e3e18b0` |
| 30/05/2026, 21:37:44 | `50f7167` | Fix assignee showing as unassigned in lead side panel. | [preview](https://connect-intel-mi6yvpg2q-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 50f7167` |
| 30/05/2026, 21:31:55 | `d47ce0c` | Reject placeholder and reserved domains in email validation. | [preview](https://connect-intel-1qrvtif0d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d47ce0c` |
| 30/05/2026, 21:27:14 | `2e51325` | Add pipeline email validation icons (Phase 1). | [preview](https://connect-intel-apqo7rr6n-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2e51325` |
| 30/05/2026, 20:36:37 | `a56f9c9` | Fix pipeline empty state when filters return no matches. | [preview](https://connect-intel-7fumqcebo-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a56f9c9` |
| 30/05/2026, 20:31:07 | `27346e0` | Update production log after pipeline filter apply deploy. | [preview](https://connect-intel-oczc1kbyq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 27346e0` |
| 30/05/2026, 20:30:21 | `19f05f9` | Apply pipeline filters immediately without a separate Search step. | [preview](https://connect-intel-fhzt2thxc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 19f05f9` |
| 30/05/2026, 20:24:31 | `0f2a5a3` | Update production log after leads label visibility deploy. | [preview](https://connect-intel-1jles3l5e-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0f2a5a3` |
| 30/05/2026, 20:23:46 | `e232928` | Keep leads action and filter labels visible on all viewports. | [preview](https://connect-intel-pqm5anllm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e232928` |
| 30/05/2026, 20:20:32 | `2ba48fe` | Update production log after leads mobile UI deploy. | [preview](https://connect-intel-77y4cidjl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2ba48fe` |
| 30/05/2026, 20:19:43 | `f65acc0` | Restore leads mobile labels, SVG filter icons, and display settings access. | [preview](https://connect-intel-e766efbj0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f65acc0` |
| 30/05/2026, 20:15:09 | `8a45175` | Update production log after settings icon contrast deploy. | [preview](https://connect-intel-6theck939-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8a45175` |
| 30/05/2026, 20:14:21 | `56af2c7` | Fix settings nav icon contrast with currentColor stroke gear. | [preview](https://connect-intel-76l7mi984-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 56af2c7` |

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
