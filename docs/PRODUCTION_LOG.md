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
| Commit | `d11296b` |
| Log updated (IST) | 30/05/2026, 19:23:48 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 30/05/2026, 19:23:40 | `d11296b` | Fix pipeline crash from missing useIsMobile import and trim mobile helper copy. | [preview](https://connect-intel-o6ika4700-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d11296b` | **← LIVE**
| 30/05/2026, 19:15:04 | `4772f58` | Update production log after UI copy cleanup deploy. | [preview](https://connect-intel-209jqndz4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4772f58` |
| 30/05/2026, 19:14:34 | `77d4925` | Remove instructional helper copy for a cleaner CRM UI. | [preview](https://connect-intel-8hn1h0bic-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 77d4925` |
| 30/05/2026, 19:07:56 | `5b352c8` | Update production log after keyboard shortcuts deploy. | [preview](https://connect-intel-7prra6ksc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5b352c8` |
| 30/05/2026, 19:07:21 | `ba876b1` | Restore native keyboard shortcuts and selectable text across the CRM. | [preview](https://connect-intel-nkt8tztzz-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ba876b1` |
| 30/05/2026, 19:03:06 | `39a73d0` | Update production log after browser back navigation deploy. | [preview](https://connect-intel-nppukrvef-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 39a73d0` |
| 30/05/2026, 19:02:33 | `385aa91` | Enable browser back/forward navigation across in-app panels and leads. | [preview](https://connect-intel-ilzcdmooo-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 385aa91` |
| 30/05/2026, 18:58:21 | `e8a4bc4` | Update production log after pipeline assignee filter deploy. | [preview](https://connect-intel-myw34rx16-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e8a4bc4` |
| 30/05/2026, 18:57:43 | `27c0fbb` | Fix pipeline assignee filter for large lead lists on mount. | [preview](https://connect-intel-rmn73g17s-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 27c0fbb` |
| 30/05/2026, 18:53:59 | `93fe270` | Update production log after team metrics assignee filter deploy. | [preview](https://connect-intel-cle6obl7d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 93fe270` |
| 30/05/2026, 18:53:17 | `3a50742` | Scope team metrics to selected rep with drill-down and persistent assignee filter. | [preview](https://connect-intel-ktmmp32ke-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3a50742` |
| 30/05/2026, 18:34:31 | `ba8fedc` | Update production log after mobile leads horizontal scroll deploy. | [preview](https://connect-intel-jafcb6sj0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ba8fedc` |
| 30/05/2026, 18:33:44 | `86758c3` | Restore horizontal scroll for mobile pipeline leads table. | [preview](https://connect-intel-463sqkpgy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 86758c3` |
| 30/05/2026, 18:30:45 | `f04bee4` | Update production log after mobile filter modal and icon sizing deploy. | [preview](https://connect-intel-ju04325y5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f04bee4` |
| 30/05/2026, 18:29:55 | `f592c7e` | Improve mobile pipeline filter modals and scale toolbar icons. | [preview](https://connect-intel-1pqukdhvr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f592c7e` |
| 30/05/2026, 18:23:48 | `3569af6` | Update production log after Contacts-style pipeline filter modals deploy. | [preview](https://connect-intel-4e88hiw02-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3569af6` |
| 30/05/2026, 18:22:41 | `82ab12b` | Use Contacts-style filter modals on mobile pipeline and fix duplicate bell. | [preview](https://connect-intel-gyckuojsr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 82ab12b` |
| 30/05/2026, 18:17:32 | `cd1f6cc` | Update production log after mobile pipeline alignment deploy. | [preview](https://connect-intel-o5ay6jxn7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- cd1f6cc` |
| 30/05/2026, 18:16:45 | `3061a9f` | Align mobile pipeline with desktop filters and merge top bar. | [preview](https://connect-intel-ljvewv40m-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3061a9f` |
| 30/05/2026, 17:54:43 | `30d5669` | Update production log after duplicate mobile header fix deploy. | [preview](https://connect-intel-f75h1ve1f-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 30d5669` |

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
