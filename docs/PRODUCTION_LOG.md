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
npm run prod:rollback -- dbdf964
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
| Commit | `458f6fb` |
| Log updated (IST) | 16/09/2026, 23:08:36 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 16/09/2026, 23:08:21 | `458f6fb` | Apply Xindus Excel ERP columns when a pipeline import updates a lead. | [preview](https://connect-intel-2i1pd86n9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 458f6fb` | **← LIVE**
| 16/09/2026, 23:05:23 | `dbdf964` | Show Xindus customer Excel fields in structured ERP Revenue and Finance tabs. | [preview](https://connect-intel-dz4n0x7yy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- dbdf964` |
| 16/09/2026, 22:46:55 | `36a751f` | Record production LIVE snapshot for ERP empty-state fallback. | [preview](https://connect-intel-j6iyrh0re-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 36a751f` |
| 16/09/2026, 22:45:09 | `1d308ed` | Fill ERP tabs from trading history on the lead and clarify empty state. | [preview](https://connect-intel-a7wf7n1kb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1d308ed` |
| 16/09/2026, 22:33:13 | `53359a6` | Record production LIVE snapshot for ERP tab populate. | [preview](https://connect-intel-1akhban7x-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 53359a6` |
| 16/09/2026, 22:32:13 | `b7aa208` | Populate lead ERP Revenue and Finance tabs from shipments, trading, and deals. | [preview](https://connect-intel-p4ybnue4n-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b7aa208` |
| 16/09/2026, 22:15:02 | `e0ef88f` | Record production LIVE snapshot for pipeline board crash fix. | [preview](https://connect-intel-icw1ayv4k-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e0ef88f` |
| 16/09/2026, 22:14:03 | `ac9b2dd` | Pass company-open props into kanban so board view does not crash. | [preview](https://connect-intel-8qc0c657o-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ac9b2dd` |
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
