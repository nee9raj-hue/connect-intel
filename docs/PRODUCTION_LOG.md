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
npm run prod:rollback -- c4a59d7
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
| Commit | `0eecdb0` |
| Log updated (IST) | 08/06/2026, 14:06:28 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 08/06/2026, 14:06:11 | `0eecdb0` | Fix pipeline bulk email creating duplicate campaigns per batch. | [preview](https://connect-intel-phn0l8g2k-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0eecdb0` | **← LIVE**
| 08/06/2026, 13:57:53 | `c4a59d7` | Log production deploy bd56469 (activity log dedupe fix). | [preview](https://connect-intel-1ebulsvt1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c4a59d7` |
| 08/06/2026, 13:57:02 | `bd56469` | Fix duplicate activities in log and dashboard after shard merge. | [preview](https://connect-intel-13g2yndve-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bd56469` |
| 08/06/2026, 13:53:42 | `971db3a` | Log production deploy ee67ea3 (team dashboard KPI fixes). | [preview](https://connect-intel-rb5hqbs70-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 971db3a` |
| 08/06/2026, 13:52:56 | `ee67ea3` | Fix team dashboard KPI counts and speed up intelligence loading. | [preview](https://connect-intel-gczzf8bri-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ee67ea3` |
| 08/06/2026, 13:33:31 | `1039b56` | Log production deploy 14587f4 (deal delete persistence fix). | [preview](https://connect-intel-itfd12ghx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1039b56` |
| 08/06/2026, 13:32:39 | `14587f4` | Fix deleted deals reappearing after refresh on dashboard and pipeline. | [preview](https://connect-intel-26jw26rpn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 14587f4` |
| 08/06/2026, 12:02:33 | `a8a204d` | Log production deploy 439540d (incoming call outcome). | [preview](https://connect-intel-9i4zlsbrg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a8a204d` |
| 08/06/2026, 11:59:07 | `439540d` | Add incoming call option to lead call outcome logging. | [preview](https://connect-intel-nkgsm5nff-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 439540d` |
| 08/06/2026, 11:18:45 | `4a4fad0` | Improve deals table layout and add bulk won/lost/delete actions. | [preview](https://connect-intel-3gxy07ktc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4a4fad0` |
| 08/06/2026, 11:03:18 | `db39a92` | Add delete option for deals and freight RFQs on leads. | [preview](https://connect-intel-5kemqs65k-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- db39a92` |
| 08/06/2026, 10:14:36 | `8d3e043` | Fix bulk email timeouts when AI personalizes each lead. | [preview](https://connect-intel-dc45994im-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8d3e043` |
| 07/06/2026, 13:53:08 | `7d42c26` | Keep users on their screen after reload and external app switches. | [preview](https://connect-intel-6oc17yum2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7d42c26` |
| 07/06/2026, 13:46:53 | `0b4706f` | Fix mobile WhatsApp share and prevent input zoom on tap. | [preview](https://connect-intel-mfpl1byk2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0b4706f` |
| 07/06/2026, 13:43:34 | `596d3e1` | Log production deploy c7bb7f4 (auto deal names + duplicate). | [preview](https://connect-intel-ax7cizqyt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 596d3e1` |
| 07/06/2026, 13:42:45 | `c7bb7f4` | Auto-generate deal names, allow rename, and add duplicate deal. | [preview](https://connect-intel-dss7hwxu6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c7bb7f4` |
| 07/06/2026, 13:28:08 | `f075305` | Log production deploy 000fdfd (dashboard freight deal counts). | [preview](https://connect-intel-iiwqk4os0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f075305` |
| 07/06/2026, 13:27:23 | `000fdfd` | Fix freight deal counts on dashboard and add won/lost sections. | [preview](https://connect-intel-6v92cm2gf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 000fdfd` |
| 07/06/2026, 13:19:50 | `759fb7b` | Log production deploy 5265d4b (deal share). | [preview](https://connect-intel-6ca1bynk2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 759fb7b` |
| 07/06/2026, 13:19:04 | `5265d4b` | Add deal share via copy, email with CC, and WhatsApp. | [preview](https://connect-intel-enz9lnnm6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5265d4b` |

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
