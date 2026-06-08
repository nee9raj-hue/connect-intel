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
npm run prod:rollback -- 4a4fad0
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
| Commit | `439540d` |
| Log updated (IST) | 08/06/2026, 12:00:35 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 08/06/2026, 11:59:07 | `439540d` | Add incoming call option to lead call outcome logging. | [preview](https://connect-intel-nkgsm5nff-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 439540d` | **← LIVE**
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
| 07/06/2026, 13:11:51 | `6173cbf` | Log production deploy 5041fa4 (freight deal types). | [preview](https://connect-intel-2kj98s5qq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6173cbf` |
| 07/06/2026, 13:11:07 | `5041fa4` | Add freight deal types with invoice vs freight charges split. | [preview](https://connect-intel-kljczdt1j-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5041fa4` |
| 07/06/2026, 13:08:38 | `6d35d01` | Log production deploy cdc422b (sidebar flyout + RFQ fields). | [preview](https://connect-intel-kg9h3z5nr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6d35d01` |
| 07/06/2026, 13:07:47 | `cdc422b` | Fix collapsed pipeline flyouts and add RFQ incoterm fields. | [preview](https://connect-intel-4cte2giix-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- cdc422b` |
| 07/06/2026, 13:01:16 | `c74a935` | Log production deploy 38bd279 (freight deal stages fix). | [preview](https://connect-intel-p1zw1iafa-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c74a935` |
| 07/06/2026, 13:00:21 | `38bd279` | Use freight-specific deal stages instead of lead pipeline statuses. | [preview](https://connect-intel-mj8myxp8h-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 38bd279` |
| 07/06/2026, 12:50:51 | `636afe1` | Log production deploy 873c78e (freight deal pipeline nav). | [preview](https://connect-intel-er91bkjol-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 636afe1` |
| 07/06/2026, 12:50:04 | `873c78e` | Add freight deal pipeline nav, dashboard block, and transport mode. | [preview](https://connect-intel-7gk6w4khj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 873c78e` |

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
