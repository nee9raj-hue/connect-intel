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
npm run prod:rollback -- 0913764
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
| Commit | `ac9b2dd` |
| Log updated (IST) | 16/09/2026, 22:14:09 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 16/09/2026, 22:14:03 | `ac9b2dd` | Pass company-open props into kanban so board view does not crash. | [preview](https://connect-intel-8qc0c657o-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ac9b2dd` | **← LIVE**
| 16/09/2026, 22:07:29 | `0913764` | Record production LIVE snapshot for findPipelineEntry restore. | [preview](https://connect-intel-erqtmrhqm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0913764` |
| 16/09/2026, 22:06:19 | `dc12696` | Restore findPipelineEntry import so lead tag and CRM saves work. | [preview](https://connect-intel-8uxkyza8p-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- dc12696` |
| 16/09/2026, 22:04:00 | `11ddb5b` | Record production deploy f23e34c as LIVE. | [preview](https://connect-intel-c1f5j6f5d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 11ddb5b` |
| 16/09/2026, 22:02:56 | `f23e34c` | Fix pipeline lead tagging so tag ids persist and saves are not stripped. | [preview](https://connect-intel-dpwc5lid2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f23e34c` |
| 16/09/2026, 21:24:25 | `eae1dd3` | Record production deploy bdf1df5 as LIVE. | [preview](https://connect-intel-c9hmwq318-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- eae1dd3` |
| 16/09/2026, 21:22:36 | `bdf1df5` | Ship full-page leads with team tags, team filters, and ERP tabs. | [preview](https://connect-intel-otwwdd1od-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bdf1df5` |
| 16/09/2026, 20:28:50 | `5d8700b` | Record production deploy c61e4e9 as LIVE. | [preview](https://connect-intel-ghwu48fkx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5d8700b` |
| 16/09/2026, 20:07:18 | `c61e4e9` | Record production deploy 02ad742 as LIVE. | [preview](https://connect-intel-lhdgqtuny-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c61e4e9` |
| 16/09/2026, 20:06:08 | `02ad742` | Fix deal click crash and keep CRM deals off ERP re-import. | [preview](https://connect-intel-dll3n6pum-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 02ad742` |
| 16/09/2026, 19:53:32 | `7d9f607` | Record production deploy d2e9536 as LIVE. | [preview](https://connect-intel-giuwbm6ui-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7d9f607` |
| 16/09/2026, 19:52:19 | `d2e9536` | Restore filledDealMilestones import so Pipeline Deals can load. | [preview](https://connect-intel-cxgr80b5r-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d2e9536` |
| 16/09/2026, 16:34:52 | `42ea1c3` | Record production deploy bf5f67d as LIVE. | [preview](https://connect-intel-m6d60f3rl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 42ea1c3` |
| 16/09/2026, 16:33:41 | `bf5f67d` | Restrict pipeline and deal delete to Org Admin. | [preview](https://connect-intel-fgdohfv1i-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bf5f67d` |
| 16/09/2026, 13:39:03 | `bc47465` | Record production deploy 040421e as LIVE. | [preview](https://connect-intel-9ljchbdwh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bc47465` |
| 16/09/2026, 13:36:45 | `040421e` | Replace Pipeline Deals date range with cascaded Year, Month, and Week Number filters. | [preview](https://connect-intel-e0c22a7r5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 040421e` |
| 16/09/2026, 13:21:38 | `7dd1fca` | Record production deploy ca41c41 as LIVE. | [preview](https://connect-intel-iq5tbtbkh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7dd1fca` |
| 16/09/2026, 13:19:41 | `ca41c41` | Remove duplicate deal-stage pills from the Pipeline Deals header. | [preview](https://connect-intel-3mucw1fpr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ca41c41` |
| 16/09/2026, 13:06:38 | `0c6ebce` | Record production deploy 796697d as LIVE. | [preview](https://connect-intel-41bhsp2bw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0c6ebce` |
| 16/09/2026, 13:02:28 | `796697d` | Fix Copilot crashing with Unexpected identifier pipeline_leads. | [preview](https://connect-intel-mr56j4wiq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 796697d` |

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
