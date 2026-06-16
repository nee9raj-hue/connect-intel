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
npm run prod:rollback -- 9018a97
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
| Commit | `f354208` |
| Log updated (IST) | 16/06/2026, 12:00:41 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 16/06/2026, 12:00:34 | `f354208` | Show all lead pipeline stages in the sidebar for every role. | [preview](https://connect-intel-lrv1ah915-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f354208` | **← LIVE**
| 16/06/2026, 11:58:47 | `9018a97` | chore: sync production log after lead reassignment fix deploy | [preview](https://connect-intel-11g0veckl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9018a97` |
| 16/06/2026, 11:56:57 | `3c50e86` | Allow admins, managers, and lead owners to reassign pipeline leads. | [preview](https://connect-intel-ggl4tmm59-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3c50e86` |
| 16/06/2026, 11:50:40 | `94c902a` | chore: sync production log after pipeline stages fix deploy | [preview](https://connect-intel-mwgr2gq94-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 94c902a` |
| 16/06/2026, 11:49:09 | `6b123fe` | Show full pipeline stages for all company members. | [preview](https://connect-intel-mr8hm2nmn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6b123fe` |
| 16/06/2026, 11:12:55 | `e8d82d1` | chore: sync production log after pipeline search handler fix deploy | [preview](https://connect-intel-4islq618v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e8d82d1` |
| 16/06/2026, 11:12:07 | `78551ea` | Fix pipeline text search returning unfiltered list page. | [preview](https://connect-intel-70cf03lw5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 78551ea` |
| 16/06/2026, 11:04:18 | `cffaac3` | chore: sync production log after pipeline search and email fixes deploy | [preview](https://connect-intel-9qprteqen-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- cffaac3` |
| 16/06/2026, 11:03:31 | `4d87a84` | Fix pipeline search fallback and CRM notification email subjects. | [preview](https://connect-intel-jdajkoc0y-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4d87a84` |
| 16/06/2026, 10:12:45 | `7ac4bfb` | chore: sync production log after team invite timeout fix deploy | [preview](https://connect-intel-2h98isjkv-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7ac4bfb` |
| 16/06/2026, 10:11:52 | `daac694` | Fix team invite timeouts for large org workspaces. | [preview](https://connect-intel-9262aj2pv-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- daac694` |
| 14/06/2026, 16:48:32 | `a49e07f` | chore: sync production log after pipeline owner filter fix deploy | [preview](https://connect-intel-a8ljh4fwj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a49e07f` |
| 14/06/2026, 16:47:31 | `ba87104` | Fix pipeline owner filter clearing after background refresh. | [preview](https://connect-intel-24nh970t6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ba87104` |
| 14/06/2026, 16:36:14 | `dd4329e` | chore: sync production log after SQL filter columns deploy | [preview](https://connect-intel-8kx10vau0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- dd4329e` |
| 14/06/2026, 16:29:11 | `c7a99e2` | Add SQL-backed city, state, score filters and paginated deals loading. | [preview](https://connect-intel-k1gfn51ok-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c7a99e2` |
| 14/06/2026, 16:19:46 | `fcca7f7` | chore: sync production log after pipeline performance deploy | [preview](https://connect-intel-o2ir0a51z-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- fcca7f7` |
| 14/06/2026, 16:18:59 | `8c688b9` | Speed up pipeline list with SQL follow-up filters and Meili search path. | [preview](https://connect-intel-hwwfc44gh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8c688b9` |
| 14/06/2026, 16:13:28 | `2827dd9` | chore: sync production log after pipeline RBAC hardening deploy | [preview](https://connect-intel-hkzcvjiqo-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2827dd9` |
| 14/06/2026, 16:12:46 | `fbc6297` | Harden pipeline RBAC on writes, search, and bulk paths. | [preview](https://connect-intel-do0uw5tyh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- fbc6297` |
| 14/06/2026, 15:48:19 | `a031e25` | chore: sync production log after pipeline premium UI deploy | [preview](https://connect-intel-bsbh7fcdv-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a031e25` |

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
