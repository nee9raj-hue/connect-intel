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
npm run prod:rollback -- 01d55d3
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
| Commit | `a69703d` |
| Log updated (IST) | 20/09/2026, 10:34:56 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 20/09/2026, 10:34:33 | `a69703d` | Keep Pipeline header filters from wiping other applied filters. | [preview](https://connect-intel-bcl9q1fec-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a69703d` | **← LIVE**
| 20/09/2026, 10:26:36 | `01d55d3` | Stop Pipeline from hanging on bootstrap timeout after a cache miss. | [preview](https://connect-intel-qxw69dyk7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 01d55d3` |
| 20/09/2026, 10:14:27 | `78cee03` | Add multi-select filters on Pipeline column headers for status, tags, last shipment, and notes. | [preview](https://connect-intel-8izw8k55o-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 78cee03` |
| 20/09/2026, 09:53:13 | `e01c463` | Ship pipeline filter updates: drop top-bar duplicates, multi-month last shipment, and CRM stages that union with ERP filters. | [preview](https://connect-intel-g35mnjrmu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e01c463` |
| 20/09/2026, 09:20:34 | `69cc6ab` | Show ERP pipeline stages as read-only CRM tags and include them in the ERP tags filter. | [preview](https://connect-intel-qg5s0gha7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 69cc6ab` |
| 20/09/2026, 02:41:09 | `b461714` | Open combined Pipeline on click and show CRM vs ERP stages on hover. | [preview](https://connect-intel-er3e0tnfs-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b461714` |
| 20/09/2026, 02:35:32 | `4fc27fe` | Show combined All leads on Pipeline hover and add ERP tags to the top filters. | [preview](https://connect-intel-lsmpd210u-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4fc27fe` |
| 20/09/2026, 02:21:41 | `25a6db5` | Show separate CRM and ERP pipelines and read ERP tags from revenue.tags. | [preview](https://connect-intel-irujgwwm6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 25a6db5` |
| 20/09/2026, 02:06:43 | `0f1004d` | Keep read-only ERP tag chips off CRM tagIds on list and workspace refresh. | [preview](https://connect-intel-hv44w7eb3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0f1004d` |
| 20/09/2026, 02:00:22 | `d2726dc` | Show read-only ERP tags separately from CRM tagIds. | [preview](https://connect-intel-qcmtpoejk-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d2726dc` |
| 19/09/2026, 19:19:59 | `c79535a` | Restore sessionError so the CRM shell can render after Reconnect. | [preview](https://connect-intel-6914nqeeh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c79535a` |
| 19/09/2026, 19:16:32 | `5dd1efa` | Show Pipeline leads when SQL org ids no longer match the session. | [preview](https://connect-intel-blcu7b3cv-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5dd1efa` |
| 19/09/2026, 19:04:26 | `72073a4` | Stop company Pipeline from waiting on the pipeline-index blob. | [preview](https://connect-intel-orjnc8q96-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 72073a4` |
| 19/09/2026, 18:55:19 | `c377f10` | Record production LIVE snapshot for restored sign-in path. | [preview](https://connect-intel-27g2rrzw7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c377f10` |
| 19/09/2026, 18:54:16 | `efddd8b` | Stop sign-in from downloading the users blob and fix crm.xindus.net cookies. | [preview](https://connect-intel-f1ryx2ncy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- efddd8b` |
| 19/09/2026, 18:48:56 | `f0ff339` | Record production LIVE snapshot after reverting to 72585b6 tree. | [preview](https://connect-intel-3zswzxcw9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f0ff339` |
| 19/09/2026, 18:47:08 | `b2a6279` | Revert 2780b65 and every commit after it. | [preview](https://connect-intel-2rio7cavx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b2a6279` |
| 19/09/2026, 18:29:24 | `6bf2234` | Record production LIVE snapshot for pipeline-index timeout fix. | [preview](https://connect-intel-kcbonvaza-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6bf2234` |
| 19/09/2026, 18:27:59 | `afe217a` | Stop Team and Pipeline from waiting on the pipeline-index blob. | [preview](https://connect-intel-ox1lbea53-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- afe217a` |
| 19/09/2026, 18:21:12 | `f4666a3` | Record production LIVE snapshot for 2a1fb30. | [preview](https://connect-intel-1a0j01l0e-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f4666a3` |

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
