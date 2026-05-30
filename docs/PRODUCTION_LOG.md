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
npm run prod:rollback -- 1e99102
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
| Commit | `e232928` |
| Log updated (IST) | 30/05/2026, 20:24:00 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 30/05/2026, 20:23:46 | `e232928` | Keep leads action and filter labels visible on all viewports. | [preview](https://connect-intel-pqm5anllm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e232928` | **← LIVE**
| 30/05/2026, 20:20:32 | `2ba48fe` | Update production log after leads mobile UI deploy. | [preview](https://connect-intel-77y4cidjl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2ba48fe` |
| 30/05/2026, 20:19:43 | `f65acc0` | Restore leads mobile labels, SVG filter icons, and display settings access. | [preview](https://connect-intel-e766efbj0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f65acc0` |
| 30/05/2026, 20:15:09 | `8a45175` | Update production log after settings icon contrast deploy. | [preview](https://connect-intel-6theck939-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8a45175` |
| 30/05/2026, 20:14:21 | `56af2c7` | Fix settings nav icon contrast with currentColor stroke gear. | [preview](https://connect-intel-76l7mi984-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 56af2c7` |
| 30/05/2026, 20:11:18 | `f612fc9` | Update production log after display settings deploy. | [preview](https://connect-intel-h4iuk66xd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f612fc9` |
| 30/05/2026, 20:10:36 | `3e089c7` | Add user display settings with group-wise font and icon scaling. | [preview](https://connect-intel-cj5gwn18d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3e089c7` |
| 30/05/2026, 20:05:41 | `30e9f48` | Update production log after sidebar typography deploy. | [preview](https://connect-intel-aag8o9qeu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 30e9f48` |
| 30/05/2026, 20:04:55 | `dc32d9d` | Align left sidebar typography with HubSpot premium font scale. | [preview](https://connect-intel-otwxwoq9e-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- dc32d9d` |
| 30/05/2026, 20:03:07 | `3ce8b0f` | Update production log after mobile bottom nav deploy. | [preview](https://connect-intel-jvdea68nr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3ce8b0f` |
| 30/05/2026, 20:02:20 | `63f2652` | Improve mobile bottom nav with larger icons and scrollable shortcuts. | [preview](https://connect-intel-5p4jbtuxh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 63f2652` |
| 30/05/2026, 19:57:08 | `2ce0201` | Update production log after full HubSpot UI deploy. | [preview](https://connect-intel-adoyfiioc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2ce0201` |
| 30/05/2026, 19:56:19 | `81b738c` | Extend HubSpot premium UI across all CRM surfaces. | [preview](https://connect-intel-7wgjico68-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 81b738c` |
| 30/05/2026, 19:34:25 | `d4c6341` | Update production log after HubSpot premium UI deploy. | [preview](https://connect-intel-3cgm2xxg9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d4c6341` |
| 30/05/2026, 19:33:55 | `9e237db` | Apply HubSpot-style premium UI theme across CRM surfaces. | [preview](https://connect-intel-isr7ovqs6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9e237db` |
| 30/05/2026, 19:24:16 | `aad438b` | Update production log after pipeline PWA crash fix deploy. | [preview](https://connect-intel-jf7wxh3zn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- aad438b` |
| 30/05/2026, 19:23:40 | `d11296b` | Fix pipeline crash from missing useIsMobile import and trim mobile helper copy. | [preview](https://connect-intel-o6ika4700-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d11296b` |
| 30/05/2026, 19:15:04 | `4772f58` | Update production log after UI copy cleanup deploy. | [preview](https://connect-intel-209jqndz4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4772f58` |
| 30/05/2026, 19:14:34 | `77d4925` | Remove instructional helper copy for a cleaner CRM UI. | [preview](https://connect-intel-8hn1h0bic-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 77d4925` |
| 30/05/2026, 19:07:56 | `5b352c8` | Update production log after keyboard shortcuts deploy. | [preview](https://connect-intel-7prra6ksc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5b352c8` |

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
