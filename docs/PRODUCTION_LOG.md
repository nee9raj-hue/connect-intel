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
npm run prod:rollback -- b801a44
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
| Commit | `b2fa6ea` |
| Log updated (IST) | 17/09/2026, 14:55:42 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 17/09/2026, 14:55:35 | `b2fa6ea` | Assign ERP-imported leads to CRM teammates by email or name so newly added reps see their book. | [preview](https://connect-intel-1fvyaqg2q-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b2fa6ea` | **← LIVE**
| 17/09/2026, 14:43:13 | `b801a44` | Record production LIVE snapshot for last shipment pipeline filter. | [preview](https://connect-intel-rkrf8cuuh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b801a44` |
| 17/09/2026, 14:40:56 | `195685b` | Add a pipeline Last shipment year and month filter so reps can list leads by last ERP shipment period. | [preview](https://connect-intel-nubtdglgr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 195685b` |
| 17/09/2026, 11:13:34 | `1e332de` | Record production LIVE snapshot for New Account CRM stage. | [preview](https://connect-intel-4r46phyga-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1e332de` |
| 17/09/2026, 11:12:39 | `5dd196d` | Add a New Account pipeline stage for recently onboarded ERP customers who have not traded yet. | [preview](https://connect-intel-kw6isql6c-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5dd196d` |
| 17/09/2026, 10:39:29 | `73ef1fa` | Record production LIVE snapshot for team manager assignment fix. | [preview](https://connect-intel-81rg32ek0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 73ef1fa` |
| 17/09/2026, 10:38:35 | `0281e80` | Fix assigning a team manager by resolving the SQL profile id that was never imported. | [preview](https://connect-intel-b7a6soz9t-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0281e80` |
| 17/09/2026, 10:30:27 | `baf6053` | Record production LIVE snapshot for ERP retention owners. | [preview](https://connect-intel-q1y022stu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- baf6053` |
| 17/09/2026, 10:29:38 | `456e1cf` | Use ERP onboarding dates and sales owners on Retention, keep unmatched accounts unassigned, and let team managers see their members. | [preview](https://connect-intel-o4v5z7wao-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 456e1cf` |
| 17/09/2026, 09:57:26 | `c3f8ab6` | Record production LIVE snapshot for Retention onboarding dashboard. | [preview](https://connect-intel-q9ws57orm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c3f8ab6` |
| 17/09/2026, 09:56:15 | `227659b` | Add a Retention onboarding grid under Sales pipeline, with year, month, week, owner, and team filters. | [preview](https://connect-intel-pd01t6s9z-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 227659b` |
| 17/09/2026, 09:37:30 | `b0baa7e` | Rebuild Home dashboard around unique customers by week, with CRM tag, status, and owner filters. | [preview](https://connect-intel-l0a7jy603-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b0baa7e` |
| 17/09/2026, 00:12:53 | `7c52c99` | Show last order on Overview, pipeline table, and as the first card on ERP Revenue. | [preview](https://connect-intel-gs1ei644d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7c52c99` |
| 16/09/2026, 23:53:04 | `11843e2` | Add a Trade profile tab on the lead so reps can save shipping fit for service decisions. | [preview](https://connect-intel-qwuxz213t-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 11843e2` |
| 16/09/2026, 23:37:21 | `439f7af` | Map account pipeline statuses onto the public.leads check constraint so CRM payload upserts succeed. | [preview](https://connect-intel-liedo3oyb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 439f7af` |
| 16/09/2026, 23:34:54 | `039da35` | Await enterprise lead sync during ERP overlay so crm_payload.lastOrderCreatedAt is written. | [preview](https://connect-intel-qctvyfcrh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 039da35` |
| 16/09/2026, 23:29:44 | `f8949dc` | Stamp lastOrderCreatedAt on CRM payload from last transacted date. | [preview](https://connect-intel-jv2bj8so4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f8949dc` |
| 16/09/2026, 23:18:35 | `4d4d34b` | Add production ERP backfill endpoint and push Xindus Excel overlays onto leads. | [preview](https://connect-intel-olxr4f4is-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4d4d34b` |
| 16/09/2026, 23:09:21 | `f5586ce` | Record production LIVE snapshot for ERP Excel tab layout. | [preview](https://connect-intel-d3o7zdv02-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f5586ce` |
| 16/09/2026, 23:08:21 | `458f6fb` | Apply Xindus Excel ERP columns when a pipeline import updates a lead. | [preview](https://connect-intel-2i1pd86n9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 458f6fb` |

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
