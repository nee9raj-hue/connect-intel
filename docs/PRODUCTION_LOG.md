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
npm run prod:rollback -- 3c0aea3
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
| Commit | `db50dc8` |
| Log updated (IST) | 08/06/2026, 22:29:38 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 08/06/2026, 22:29:23 | `db50dc8` | Rebuild Dashboard as My Day personal execution workspace. | [preview](https://connect-intel-65dipk2vv-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- db50dc8` | **← LIVE**
| 08/06/2026, 22:20:50 | `3c0aea3` | Update production log for fb8870d Activity Log hub deploy. | [preview](https://connect-intel-ipjcqfctq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3c0aea3` |
| 08/06/2026, 22:20:05 | `fb8870d` | Rebuild Activity Log as a V3 linkage hub for cross-page navigation. | [preview](https://connect-intel-2ead0m3a7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- fb8870d` |
| 08/06/2026, 22:16:36 | `c789767` | Update production log for 9ff8ed1 dashboard V3 deploy. | [preview](https://connect-intel-i4c552sm4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c789767` |
| 08/06/2026, 22:15:49 | `9ff8ed1` | Rebuild Home dashboard as a V3 command center aligned with Team Intelligence. | [preview](https://connect-intel-elf2iewea-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9ff8ed1` |
| 08/06/2026, 22:10:34 | `1a44248` | Update production log for 5900b31 Team Intelligence V3 deploy. | [preview](https://connect-intel-4s4tsackn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1a44248` |
| 08/06/2026, 22:09:44 | `5900b31` | Rebuild Team Intelligence as a V3 revenue command center. | [preview](https://connect-intel-hokjczyp3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5900b31` |
| 08/06/2026, 21:54:09 | `88d72f2` | Update production log for 1e9f225 Team Intelligence V2 deploy. | [preview](https://connect-intel-gb67of1uh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 88d72f2` |
| 08/06/2026, 21:53:18 | `1e9f225` | Redesign Team Intelligence as an executive intelligence workspace. | [preview](https://connect-intel-m5uttp6m8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1e9f225` |
| 08/06/2026, 21:38:17 | `f9b07a8` | Update production log for 240e589 CRM Phase 1 deploy. | [preview](https://connect-intel-hxcme9wd6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f9b07a8` |
| 08/06/2026, 21:37:26 | `240e589` | Add CRM Phase 1: companies hub, pipelines, workflows, timeline, scoring. | [preview](https://connect-intel-2rc6mym8v-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 240e589` |
| 08/06/2026, 21:32:39 | `12d5196` | Update production log for bfc34d4 CRM platform Phase 0 deploy. | [preview](https://connect-intel-7pmalo07t-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 12d5196` |
| 08/06/2026, 21:31:50 | `bfc34d4` | Add CRM platform Phase 0: blueprint, command palette, and unified search. | [preview](https://connect-intel-3wdssc8c9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bfc34d4` |
| 08/06/2026, 21:19:00 | `789ff50` | Update production log for 8e209f2 Marketing Domains UX fix. | [preview](https://connect-intel-hy8y9pdez-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 789ff50` |
| 08/06/2026, 21:18:15 | `8e209f2` | Fix Marketing Domains UX when work email is already connected. | [preview](https://connect-intel-ripu2i8s5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8e209f2` |
| 08/06/2026, 21:11:29 | `9b9d254` | Update production log for 03674f8 Phase 2 marketing deploy. | [preview](https://connect-intel-f2eln6kna-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9b9d254` |
| 08/06/2026, 21:10:34 | `03674f8` | Add Phase 2 marketing: canvas automations, A/B, RSS, landing pages, exports. | [preview](https://connect-intel-4rjf31tdx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 03674f8` |
| 08/06/2026, 21:02:31 | `cb3d8f6` | Update production log for 8c6ef7d email marketing deploy. | [preview](https://connect-intel-kbcvto2g4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- cb3d8f6` |
| 08/06/2026, 21:01:33 | `8c6ef7d` | Add enterprise email marketing module inside CRM Marketing. | [preview](https://connect-intel-n568uqi1i-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8c6ef7d` |
| 08/06/2026, 20:45:49 | `c16f247` | Update production log for ad3855c kanban bulk email fix deploy. | [preview](https://connect-intel-l6xuupsz1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c16f247` |

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
