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
npm run prod:rollback -- e8f11b7
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
| Commit | `5137f25` |
| Log updated (IST) | 16/06/2026, 16:40:54 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 16/06/2026, 16:40:43 | `5137f25` | Fix pipeline board showing duplicate leads across every stage column. | [preview](https://connect-intel-9cp132sck-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5137f25` | **← LIVE**
| 16/06/2026, 15:50:57 | `e8f11b7` | Harden CRM data isolation across search, bulk email, and store loads. | [preview](https://connect-intel-kbl117giv-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e8f11b7` |
| 16/06/2026, 15:50:31 | `2071690` | chore: sync production log after CRM isolation hardening deploy | [preview](https://connect-intel-3bj7pk8qw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2071690` |
| 16/06/2026, 15:36:25 | `39e4fd9` | chore: sync production log after owner_id rep visibility deploy | [preview](https://connect-intel-3d9ni0hid-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 39e4fd9` |
| 16/06/2026, 15:35:47 | `db23345` | Fix rep pipeline leak via owner_id instead of assignee-null pool. | [preview](https://connect-intel-92hyxb9kb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- db23345` |
| 16/06/2026, 14:50:39 | `915f42c` | chore: sync production log after rep pipeline visibility fix deploy | [preview](https://connect-intel-ey3hj3myd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 915f42c` |
| 16/06/2026, 14:49:48 | `64556ea` | Fix reps seeing other owners' pipeline leads. | [preview](https://connect-intel-cubn7in34-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 64556ea` |
| 16/06/2026, 13:47:24 | `4fb1b3d` | chore: sync production log after bulk assign fix deploy | [preview](https://connect-intel-dliythwaj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4fb1b3d` |
| 16/06/2026, 13:46:48 | `0244832` | Fix bulk assign ReferenceError for readPipelineLeadsByIds. | [preview](https://connect-intel-6e9q299ow-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0244832` |
| 16/06/2026, 13:44:11 | `9306c85` | chore: sync production log after deal creation schema fix deploy | [preview](https://connect-intel-q78isqt47-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9306c85` |
| 16/06/2026, 13:43:01 | `0b6d729` | Fix deal creation failing on pipeline_leads schema mismatch. | [preview](https://connect-intel-5eiavmyhd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0b6d729` |
| 16/06/2026, 13:36:30 | `d4001a3` | chore: sync production log after lead assignment persistence deploy | [preview](https://connect-intel-pqn1qeylf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d4001a3` |
| 16/06/2026, 13:35:02 | `71060bb` | Fix lead assignment not persisting after refresh. | [preview](https://connect-intel-gxxdsvrmm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 71060bb` |
| 16/06/2026, 12:38:51 | `23960d5` | chore: sync production log after concurrent load hardening deploy | [preview](https://connect-intel-j13jxrxgm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 23960d5` |
| 16/06/2026, 12:38:06 | `510bec5` | Harden concurrent multi-user load without changing CRM workflows. | [preview](https://connect-intel-l5nyhqc4v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 510bec5` |
| 16/06/2026, 12:11:28 | `aef8ae6` | chore: sync production log after pipeline search performance deploy | [preview](https://connect-intel-j59djd7w8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- aef8ae6` |
| 16/06/2026, 12:10:36 | `2861496` | Speed up pipeline lead search with scoped SQL instead of full shard scans. | [preview](https://connect-intel-enqcrzjoe-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2861496` |
| 16/06/2026, 12:01:24 | `5997bb7` | chore: sync production log after sidebar pipeline stages deploy | [preview](https://connect-intel-jmz83f0ss-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5997bb7` |
| 16/06/2026, 12:00:34 | `f354208` | Show all lead pipeline stages in the sidebar for every role. | [preview](https://connect-intel-lrv1ah915-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f354208` |
| 16/06/2026, 11:58:47 | `9018a97` | chore: sync production log after lead reassignment fix deploy | [preview](https://connect-intel-11g0veckl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9018a97` |

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
