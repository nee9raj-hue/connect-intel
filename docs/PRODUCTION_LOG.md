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
npm run prod:rollback -- 6173cbf
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
| Commit | `5265d4b` |
| Log updated (IST) | 07/06/2026, 13:19:20 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 07/06/2026, 13:19:04 | `5265d4b` | Add deal share via copy, email with CC, and WhatsApp. | [preview](https://connect-intel-enz9lnnm6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5265d4b` | **← LIVE**
| 07/06/2026, 13:11:51 | `6173cbf` | Log production deploy 5041fa4 (freight deal types). | [preview](https://connect-intel-2kj98s5qq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6173cbf` |
| 07/06/2026, 13:11:07 | `5041fa4` | Add freight deal types with invoice vs freight charges split. | [preview](https://connect-intel-kljczdt1j-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5041fa4` |
| 07/06/2026, 13:08:38 | `6d35d01` | Log production deploy cdc422b (sidebar flyout + RFQ fields). | [preview](https://connect-intel-kg9h3z5nr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6d35d01` |
| 07/06/2026, 13:07:47 | `cdc422b` | Fix collapsed pipeline flyouts and add RFQ incoterm fields. | [preview](https://connect-intel-4cte2giix-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- cdc422b` |
| 07/06/2026, 13:01:16 | `c74a935` | Log production deploy 38bd279 (freight deal stages fix). | [preview](https://connect-intel-p1zw1iafa-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c74a935` |
| 07/06/2026, 13:00:21 | `38bd279` | Use freight-specific deal stages instead of lead pipeline statuses. | [preview](https://connect-intel-mj8myxp8h-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 38bd279` |
| 07/06/2026, 12:50:51 | `636afe1` | Log production deploy 873c78e (freight deal pipeline nav). | [preview](https://connect-intel-er91bkjol-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 636afe1` |
| 07/06/2026, 12:50:04 | `873c78e` | Add freight deal pipeline nav, dashboard block, and transport mode. | [preview](https://connect-intel-7gk6w4khj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 873c78e` |
| 07/06/2026, 12:39:09 | `fcfd004` | Log production deploy 20d32df (pipeline timeout fixes). | [preview](https://connect-intel-c9wjr2amh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- fcfd004` |
| 07/06/2026, 12:38:25 | `20d32df` | Fix pipeline timeouts for large orgs and freight deal saves. | [preview](https://connect-intel-nl47y7yrf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 20d32df` |
| 07/06/2026, 12:33:24 | `bc025ed` | Log production deploy 2c03ebe (freight RFQ on deals for Xindus). | [preview](https://connect-intel-nsgzbwrnz-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bc025ed` |
| 07/06/2026, 12:32:30 | `2c03ebe` | Add freight RFQ fields on deals for Xindus shipping workflows. | [preview](https://connect-intel-ni7d07ah4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2c03ebe` |
| 07/06/2026, 12:19:57 | `9e5f604` | Log production deploy 07c306d (multi-deal flow per lead). | [preview](https://connect-intel-3s9vg7mjq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9e5f604` |
| 07/06/2026, 12:19:01 | `07c306d` | Add HubSpot-style multi-deal flow per lead. | [preview](https://connect-intel-1tea6ypih-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 07c306d` |
| 07/06/2026, 11:06:48 | `8d36006` | Log production deploy ba6d814 (faster task and meeting saves). | [preview](https://connect-intel-gmav9azy3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8d36006` |
| 07/06/2026, 11:05:51 | `ba6d814` | Speed up task and meeting saves with clearer success feedback. | [preview](https://connect-intel-99kkiuedy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ba6d814` |
| 07/06/2026, 10:54:42 | `e4fd719` | Log production deploy c69dabf (inActivityPeriod ReferenceError fix). | [preview](https://connect-intel-5m77n9gw2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e4fd719` |
| 07/06/2026, 10:53:53 | `c69dabf` | Fix inActivityPeriod ReferenceError in crmTouchpoints. | [preview](https://connect-intel-86xiisxya-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c69dabf` |
| 07/06/2026, 10:52:34 | `85761b1` | Log production deploy 491231d (dashboard KPI activity count fix). | [preview](https://connect-intel-32cv678uc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 85761b1` |

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
