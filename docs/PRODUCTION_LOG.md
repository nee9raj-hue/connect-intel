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
| Commit | `3a50742` |
| Log updated (IST) | 30/05/2026, 18:53:27 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 30/05/2026, 18:53:17 | `3a50742` | Scope team metrics to selected rep with drill-down and persistent assignee filter. | [preview](https://connect-intel-ktmmp32ke-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3a50742` | **← LIVE**
| 30/05/2026, 18:34:31 | `ba8fedc` | Update production log after mobile leads horizontal scroll deploy. | [preview](https://connect-intel-jafcb6sj0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ba8fedc` |
| 30/05/2026, 18:33:44 | `86758c3` | Restore horizontal scroll for mobile pipeline leads table. | [preview](https://connect-intel-463sqkpgy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 86758c3` |
| 30/05/2026, 18:30:45 | `f04bee4` | Update production log after mobile filter modal and icon sizing deploy. | [preview](https://connect-intel-ju04325y5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f04bee4` |
| 30/05/2026, 18:29:55 | `f592c7e` | Improve mobile pipeline filter modals and scale toolbar icons. | [preview](https://connect-intel-1pqukdhvr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f592c7e` |
| 30/05/2026, 18:23:48 | `3569af6` | Update production log after Contacts-style pipeline filter modals deploy. | [preview](https://connect-intel-4e88hiw02-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3569af6` |
| 30/05/2026, 18:22:41 | `82ab12b` | Use Contacts-style filter modals on mobile pipeline and fix duplicate bell. | [preview](https://connect-intel-gyckuojsr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 82ab12b` |
| 30/05/2026, 18:17:32 | `cd1f6cc` | Update production log after mobile pipeline alignment deploy. | [preview](https://connect-intel-o5ay6jxn7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- cd1f6cc` |
| 30/05/2026, 18:16:45 | `3061a9f` | Align mobile pipeline with desktop filters and merge top bar. | [preview](https://connect-intel-ljvewv40m-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3061a9f` |
| 30/05/2026, 17:54:43 | `30d5669` | Update production log after duplicate mobile header fix deploy. | [preview](https://connect-intel-f75h1ve1f-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 30d5669` |
| 30/05/2026, 17:53:55 | `f9f25d8` | Fix duplicate mobile pipeline header and compact filter row. | [preview](https://connect-intel-ed0tl5ua8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f9f25d8` |
| 30/05/2026, 17:49:25 | `f5e7404` | Update production log after compact mobile pipeline header deploy. | [preview](https://connect-intel-1iml3jew8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f5e7404` |
| 30/05/2026, 17:48:41 | `8e8b79f` | Compact mobile pipeline header and HubSpot filter sheets. | [preview](https://connect-intel-8ut8osdgc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8e8b79f` |
| 30/05/2026, 17:42:38 | `6e53d5b` | Update production log after per-icon mobile filter popups deploy. | [preview](https://connect-intel-qpnboa89l-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6e53d5b` |
| 30/05/2026, 17:41:54 | `d05ae11` | Add per-icon full-screen filter popups on mobile and PWA. | [preview](https://connect-intel-pm93hvm53-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d05ae11` |
| 30/05/2026, 17:35:33 | `359ed5b` | Update production log after mobile/PWA leads fixes deploy. | [preview](https://connect-intel-39i8jbqe7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 359ed5b` |
| 30/05/2026, 17:34:41 | `760df41` | Fix mobile leads call icon placement and PWA filter sheet. | [preview](https://connect-intel-dgy6ilxrp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 760df41` |
| 30/05/2026, 17:27:18 | `08b9487` | Update production log after mobile pipeline filters deploy. | [preview](https://connect-intel-iejkg3y45-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 08b9487` |
| 30/05/2026, 17:26:31 | `c32e770` | Add full-screen HubSpot-style lead filters on mobile. | [preview](https://connect-intel-aw0to2vns-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c32e770` |
| 30/05/2026, 17:21:59 | `2848646` | Update production log after safety tooling deploy. | [preview](https://connect-intel-h84wkqgtd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2848646` |

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
