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
npm run prod:rollback -- 1c30efe
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
| Commit | `90c4f6a` |
| Log updated (IST) | 13/06/2026, 20:00:46 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 13/06/2026, 20:00:32 | `90c4f6a` | feat: full-page campaign reports in new tabs with engagement charts | [preview](https://connect-intel-h17vlw4m6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 90c4f6a` | **← LIVE**
| 13/06/2026, 19:54:16 | `1c30efe` | chore: sync production log after analytics team filter fix | [preview](https://connect-intel-rkaegt9dn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1c30efe` |
| 13/06/2026, 19:53:30 | `0cecc46` | fix: analytics team filter matches campaign owner user ids | [preview](https://connect-intel-kkbjcp97p-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0cecc46` |
| 13/06/2026, 19:34:03 | `ab64547` | chore: sync production log after analytics redesign deploy | [preview](https://connect-intel-kgnvicdq7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ab64547` |
| 13/06/2026, 19:33:11 | `4e15e3b` | feat: redesign marketing analytics with filters and campaign drill-down | [preview](https://connect-intel-1acbctknb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4e15e3b` |
| 13/06/2026, 19:20:02 | `d198ab9` | chore: sync production log after campaigns loading fix | [preview](https://connect-intel-lberin2co-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d198ab9` |
| 13/06/2026, 19:19:18 | `3ce72c6` | fix: stop infinite loading loop on marketing campaigns tab | [preview](https://connect-intel-dlbq5x27r-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3ce72c6` |
| 12/06/2026, 18:29:03 | `18d764e` | chore: sync production log after campaigns page deploy | [preview](https://connect-intel-yn3axt41a-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 18d764e` |
| 12/06/2026, 18:28:15 | `a9424cd` | feat: redesign campaigns page and enrich list metrics from enrollments | [preview](https://connect-intel-i0l1mi08u-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a9424cd` |
| 12/06/2026, 17:14:40 | `03f553e` | chore: sync production log after campaign status fix deploy | [preview](https://connect-intel-llwkadlw2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 03f553e` |
| 12/06/2026, 17:13:56 | `25bd4f7` | fix: sync campaign status after test sends and background email delivery | [preview](https://connect-intel-3k8rvob2p-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 25bd4f7` |
| 12/06/2026, 17:06:45 | `d6a188f` | chore: sync production log after marketing home deploy | [preview](https://connect-intel-5vuzb6kmd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d6a188f` |
| 12/06/2026, 17:05:56 | `a76ab25` | feat: polish marketing home with illustrated create cards and getting-started guide | [preview](https://connect-intel-bslyma59g-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a76ab25` |
| 12/06/2026, 16:41:46 | `75a25bc` | chore: sync production log after template gallery deploy | [preview](https://connect-intel-lzahmwdzn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 75a25bc` |
| 12/06/2026, 16:40:55 | `f49bb6d` | feat: redesign email template gallery with branded cards and nav fix | [preview](https://connect-intel-m6lh65ow2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f49bb6d` |
| 12/06/2026, 16:19:35 | `ee50f70` | feat: Mailchimp campaign editor Styles, Sections, and Optimize panels | [preview](https://connect-intel-h1pwtudvc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ee50f70` |
| 12/06/2026, 16:02:15 | `635ec40` | feat: Mailchimp-style Audience hub with Contacts, Tags, Segments, and more | [preview](https://connect-intel-perdjx6ot-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 635ec40` |
| 12/06/2026, 15:52:08 | `c6f71e0` | feat: Mailchimp-style Email Templates page with saved list and actions | [preview](https://connect-intel-5xnqobakk-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c6f71e0` |
| 12/06/2026, 15:41:28 | `d5fec16` | feat: Mailchimp-parity campaign checklist and email editor layout | [preview](https://connect-intel-p9cp5hc1b-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d5fec16` |
| 12/06/2026, 15:26:02 | `b7d6912` | fix: add back-to-campaign close bar on email editor | [preview](https://connect-intel-hfd51i3he-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b7d6912` |

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
