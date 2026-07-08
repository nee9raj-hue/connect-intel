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
npm run prod:rollback -- 91066a8
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
| Commit | `86660c3` |
| Log updated (IST) | 08/07/2026, 16:16:47 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 08/07/2026, 16:15:57 | `86660c3` | Send small CRM bulk emails inline in-request so they no longer stall as "queued" | [preview](https://connect-intel-b2mmtgz2r-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 86660c3` | **← LIVE**
| 08/07/2026, 16:05:52 | `91066a8` | Fix bulk emails stuck at "queued" by seeding recipients sync + self-healing drain | [preview](https://connect-intel-1bex98cjf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 91066a8` |
| 08/07/2026, 15:45:21 | `1ca4600` | Stop AI CRM emails fabricating sender claims from the recipient's city. | [preview](https://connect-intel-rkpfhr1b0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1ca4600` |
| 08/07/2026, 14:37:28 | `0c93d77` | Use LinkedIn JSON-LD as authoritative employer/location source for capture. | [preview](https://connect-intel-h9ga0egom-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0c93d77` |
| 08/07/2026, 13:12:54 | `7d4324b` | Stop LinkedIn capture picking a followed company; read employer from Experience. | [preview](https://connect-intel-ih49x9tql-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7d4324b` |
| 08/07/2026, 13:03:09 | `d547877` | Fix LinkedIn capture grabbing wrong company and headline as location. | [preview](https://connect-intel-6e38d3vtu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d547877` |
| 08/07/2026, 12:51:39 | `1bf09d2` | Sync contact edits to pipeline table, not just the shard mirror. | [preview](https://connect-intel-2l1aij9nj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1bf09d2` |
| 08/07/2026, 12:45:13 | `c6afbae` | Persist contact email/phone edits to linked pipeline leads. | [preview](https://connect-intel-nrph1ts2a-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c6afbae` |
| 07/07/2026, 23:52:39 | `c44e2d0` | Disable Team intelligence and non-core CRM analytics from the product shell. | [preview](https://connect-intel-65qrrf2zf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c44e2d0` |
| 07/07/2026, 23:47:46 | `7726f86` | Allow reps to delete their own pipeline leads without org-wide delete permission. | [preview](https://connect-intel-om9dtcm1o-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7726f86` |
| 07/07/2026, 23:43:51 | `4abe24f` | Prevent duplicate pipeline leads from extension capture and manual add. | [preview](https://connect-intel-9se2v8vo2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4abe24f` |
| 07/07/2026, 23:36:13 | `657c9b1` | Fix Copilot misrouting fresh FBA discovery queries to stale session memory. | [preview](https://connect-intel-57ac8arfe-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 657c9b1` |
| 07/07/2026, 23:29:06 | `c789337` | Improve Copilot LinkedIn profile accuracy with verified web discovery. | [preview](https://connect-intel-l08eq7qqn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c789337` |
| 07/07/2026, 23:16:55 | `ee1db2c` | Fix extension capture persistence and LinkedIn location extraction. | [preview](https://connect-intel-9xt7e13qh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ee1db2c` |
| 07/07/2026, 23:04:56 | `0ea7939` | Enrich existing pipeline leads when extension captures LinkedIn profiles. | [preview](https://connect-intel-e51usrnba-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0ea7939` |
| 07/07/2026, 22:54:53 | `e528c72` | Fix Copilot transparent icon and extension LinkedIn profile capture. | [preview](https://connect-intel-ntu0g3nrc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e528c72` |
| 07/07/2026, 22:46:57 | `7fe06b4` | Fix production white screen from missing BoltIcon import. | [preview](https://connect-intel-e6toi4qad-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7fe06b4` |
| 07/07/2026, 22:42:41 | `674b77b` | Enrich Chrome extension LinkedIn capture for full CRM pipeline fields. | [preview](https://connect-intel-mtwpxuloa-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 674b77b` |
| 07/07/2026, 22:32:04 | `b0fd1a5` | Replace Connect Copilot icon with new innovation brand mark. | [preview](https://connect-intel-2j1agxdfi-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b0fd1a5` |
| 07/07/2026, 22:26:04 | `ce5bc5d` | Polish Copilot knowledge results: compact reply, dedupe, and LinkedIn. | [preview](https://connect-intel-bp3rgwnkd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ce5bc5d` |

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
