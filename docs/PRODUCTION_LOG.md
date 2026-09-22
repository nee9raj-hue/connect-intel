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
npm run prod:rollback -- 367c6d7
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
| Commit | `4db6966` |
| Log updated (IST) | 22/09/2026, 20:08:04 |

---

## Safe restore codes

These are exact production builds to restore if a later change goes wrong. Tell the assistant the **code** (for example `S-2EA18A4`).

| Code | Commit | Note | Recorded (IST) | Restore |
|------|--------|------|----------------|---------|
| `S-1A915E5` | `1a915e5` | Healthy CRM snapshot before a later change | 22/09/2026, 20:06:42 | `npm run prod:rollback -- S-1A915E5` |
| `S-1CF3E1C` | `1cf3e1c` | Healthy CRM snapshot before a later change | 22/09/2026, 16:18:13 | `npm run prod:rollback -- S-1CF3E1C` |
| `S-311AE71` | `311ae71` | Healthy CRM snapshot before a later change | 22/09/2026, 15:03:28 | `npm run prod:rollback -- S-311AE71` |
| `S-485FC4A` | `485fc4a` | 485fc4a | 21/09/2026, 11:40:58 | `npm run prod:rollback -- S-485FC4A` |
| `S-2C53FBD` | `2c53fbd` | 2c53fbd | 21/09/2026, 10:52:23 | `npm run prod:rollback -- S-2C53FBD` |
| `S-66F9509` | `66f9509` | 66f9509 | 21/09/2026, 10:00:37 | `npm run prod:rollback -- S-66F9509` |
| `S-2EA18A4` | `2ea18a4` | 2ea18a4 | 21/09/2026, 00:41:11 | `npm run prod:rollback -- S-2EA18A4` |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 22/09/2026, 20:07:46 | `4db6966` | Keep Pipeline search results stable across back-to-back queries and assign tags on the fast patch path. | [preview](https://connect-intel-5e5lyi3zk-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4db6966` | **← LIVE**
| 22/09/2026, 19:36:26 | `367c6d7` | Record production LIVE at 1a915e5. | [preview](https://connect-intel-1q1llr3rg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 367c6d7` |
| 22/09/2026, 19:35:28 | `1a915e5` | Fix Pipeline white-screen when searching or filtering contacts. | [preview](https://connect-intel-hu4bvenh6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1a915e5` |
| 22/09/2026, 16:28:04 | `57299f2` | Record production LIVE at 86e0474. | [preview](https://connect-intel-n439pcrrw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 57299f2` |
| 22/09/2026, 16:27:05 | `86e0474` | Stop tag create/list from loading the full CRM store so reps and managers no longer time out. | [preview](https://connect-intel-iy0mrfeyj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 86e0474` |
| 22/09/2026, 16:20:48 | `f7f4bf0` | Record production LIVE at b80aa92. | [preview](https://connect-intel-ac5ewmv64-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f7f4bf0` |
| 22/09/2026, 16:19:19 | `b80aa92` | Let reps create personal CRM tags that only they and admins can use. | [preview](https://connect-intel-7f10oj4k7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b80aa92` |
| 22/09/2026, 15:06:31 | `521977a` | Record production LIVE at 1cf3e1c. | [preview](https://connect-intel-6bqjaxsm3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 521977a` |
| 22/09/2026, 15:04:35 | `1cf3e1c` | Show Pipeline for reps whose Google login id is a duplicate of their CRM book. | [preview](https://connect-intel-9sqwdhk3z-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1cf3e1c` |
| 21/09/2026, 19:04:45 | `67b70cd` | Record production LIVE at 311ae71. | [preview](https://connect-intel-qmbhnyjtu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 67b70cd` |
| 21/09/2026, 19:03:35 | `311ae71` | Clear leftover app cache so the restored CRM can fetch again. | [preview](https://connect-intel-9efzb9qem-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 311ae71` |
| 21/09/2026, 18:54:23 | `25e05c2` | Record production LIVE at the restored 4c0640e snapshot. | [preview](https://connect-intel-ha14sol5w-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 25e05c2` |
| 21/09/2026, 18:52:47 | `b75be84` | Restore production to the 4c0640e working snapshot. | [preview](https://connect-intel-h5xf8or7t-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b75be84` |
| 21/09/2026, 18:14:49 | `153ea47` | Record production LIVE at 7274334. | [preview](https://connect-intel-1u1z5jgm4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 153ea47` |
| 21/09/2026, 18:13:49 | `7274334` | Stop the workspace spinner from waiting forever after Google sign-in. | [preview](https://connect-intel-lb7aph9mm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7274334` |
| 21/09/2026, 18:10:38 | `222c7d6` | Record production LIVE at f729182. | [preview](https://connect-intel-iguvi8bn4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 222c7d6` |
| 21/09/2026, 18:06:12 | `f729182` | Record production LIVE at 30191ad. | [preview](https://connect-intel-ecofq9930-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f729182` |
| 21/09/2026, 18:05:00 | `30191ad` | Stop sign-in from aborting as a timeout and give Pipeline more time to load. | [preview](https://connect-intel-9slthx421-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 30191ad` |
| 21/09/2026, 17:55:06 | `91af4cd` | Record production LIVE at 007f74d. | [preview](https://connect-intel-9xg7anqbb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 91af4cd` |
| 21/09/2026, 17:53:47 | `007f74d` | Record production LIVE at df78703. | [preview](https://connect-intel-3yjorsay1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 007f74d` |

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
| `npm run prod:rollback -- <commit-or-safe-code>` | Point production domain at that deployment |
| `npm run prod:ship` | Pre-flight checks before pushing to `main` |
| `npm run prod:verify` | Build + verify critical files only |
| `npm run prod:tag -- [commit]` | Git tag for a known-good production commit |
| `npm run prod:safe` | Snapshot the current LIVE CRM as a restore code before a risky change |

---

*Auto-generated by `scripts/production-log.mjs markdown`. Edit notes in `docs/production-log.json` only.*
