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
npm run prod:rollback -- 75a25bc
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
| Commit | `a76ab25` |
| Log updated (IST) | 12/06/2026, 17:06:08 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 12/06/2026, 17:05:56 | `a76ab25` | feat: polish marketing home with illustrated create cards and getting-started guide | [preview](https://connect-intel-bslyma59g-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a76ab25` | **← LIVE**
| 12/06/2026, 16:41:46 | `75a25bc` | chore: sync production log after template gallery deploy | [preview](https://connect-intel-lzahmwdzn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 75a25bc` |
| 12/06/2026, 16:40:55 | `f49bb6d` | feat: redesign email template gallery with branded cards and nav fix | [preview](https://connect-intel-m6lh65ow2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f49bb6d` |
| 12/06/2026, 16:19:35 | `ee50f70` | feat: Mailchimp campaign editor Styles, Sections, and Optimize panels | [preview](https://connect-intel-h1pwtudvc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ee50f70` |
| 12/06/2026, 16:02:15 | `635ec40` | feat: Mailchimp-style Audience hub with Contacts, Tags, Segments, and more | [preview](https://connect-intel-perdjx6ot-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 635ec40` |
| 12/06/2026, 15:52:08 | `c6f71e0` | feat: Mailchimp-style Email Templates page with saved list and actions | [preview](https://connect-intel-5xnqobakk-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c6f71e0` |
| 12/06/2026, 15:41:28 | `d5fec16` | feat: Mailchimp-parity campaign checklist and email editor layout | [preview](https://connect-intel-p9cp5hc1b-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d5fec16` |
| 12/06/2026, 15:26:02 | `b7d6912` | fix: add back-to-campaign close bar on email editor | [preview](https://connect-intel-hfd51i3he-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b7d6912` |
| 12/06/2026, 15:08:16 | `9200201` | feat: full Mailchimp-style marketing hub shell, campaigns list, and editor | [preview](https://connect-intel-fr90xnn8j-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9200201` |
| 12/06/2026, 14:15:58 | `4c0f0b3` | feat: Mailchimp-style marketing hub with checklist campaign builder | [preview](https://connect-intel-oywz4b6pu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4c0f0b3` |
| 12/06/2026, 12:53:05 | `98c0262` | fix: marketing reports drill down to filtered pipeline by lead IDs | [preview](https://connect-intel-cnzw8o7sb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 98c0262` |
| 12/06/2026, 12:31:09 | `45b80b3` | perf: speed up marketing hub by skipping heavy enrollment reads | [preview](https://connect-intel-hnbinisb1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 45b80b3` |
| 12/06/2026, 02:47:32 | `e5b3750` | fix: pipeline owner filter uses assignee-or-saver ownership model | [preview](https://connect-intel-qga9yeyu6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e5b3750` |
| 12/06/2026, 02:42:59 | `a10d75e` | feat: hide city, state, and tags from default pipeline columns | [preview](https://connect-intel-93v4u2kuj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a10d75e` |
| 12/06/2026, 02:37:11 | `76d27e4` | fix: pipeline owner filter matches assigned rep shown in table | [preview](https://connect-intel-7jfcp5cy6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 76d27e4` |
| 12/06/2026, 02:31:19 | `e71bbd9` | fix: recover from stale PWA cache after production deploys | [preview](https://connect-intel-h73lkwiwf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e71bbd9` |
| 12/06/2026, 02:25:06 | `89c7245` | chore: production log after calendar drawer and pipeline filter deploy | [preview](https://connect-intel-ncij3a53c-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 89c7245` |
| 12/06/2026, 02:24:35 | `af832af` | style: tone down dashboard orange for a cleaner home overview | [preview](https://connect-intel-hbm2jeqns-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- af832af` |
| 12/06/2026, 02:22:01 | `733dbd6` | chore: production log after pipeline assignee filter deploy | [preview](https://connect-intel-iyp8l4oyw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 733dbd6` |
| 12/06/2026, 02:20:41 | `f2c8bd1` | fix: pipeline owner filter for saved-by leads and sidebar stage nav | [preview](https://connect-intel-didx9h8lc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f2c8bd1` |

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
