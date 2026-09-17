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
npm run prod:rollback -- 632a41d
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
| Commit | `0eb0d66` |
| Log updated (IST) | 17/09/2026, 23:51:38 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 17/09/2026, 23:51:13 | `0eb0d66` | Restage ERP accounts from first and last shipment, match short names like XLP, and hide sidebar items a role cannot use. | [preview](https://connect-intel-4tupl63g9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0eb0d66` | **← LIVE**
| 17/09/2026, 22:59:47 | `632a41d` | Record production LIVE snapshot for Unique customers list removal. | [preview](https://connect-intel-c56rmof8a-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 632a41d` |
| 17/09/2026, 22:58:32 | `a6c9bed` | Remove the Unique customers owner list from Home so the dashboard only shows period totals. | [preview](https://connect-intel-m3fonbipr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a6c9bed` |
| 17/09/2026, 22:44:49 | `2430f9f` | Record production LIVE snapshot for Home dashboard ERP shipment facts. | [preview](https://connect-intel-a07iz3ljh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2430f9f` |
| 17/09/2026, 22:43:23 | `d2ff4e4` | Fill Home dashboard widgets from ERP shipment dates and match overlay rows that the pipeline missed. | [preview](https://connect-intel-4a0astmas-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d2ff4e4` |
| 17/09/2026, 22:30:19 | `8ea23ee` | Record production LIVE snapshot for team pipeline sharing and locked rep nav. | [preview](https://connect-intel-nnmhkf26q-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8ea23ee` |
| 17/09/2026, 22:28:49 | `8295de2` | Let teammates share pipeline via team and allowed tags, grey out locked rep features, and keep the default view assigned-only. | [preview](https://connect-intel-9qewlbvio-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8295de2` |
| 17/09/2026, 21:48:21 | `1f26345` | Record production LIVE snapshot for ERP owner filter aliases. | [preview](https://connect-intel-ou9423rjj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1f26345` |
| 17/09/2026, 21:47:08 | `cc694f4` | Show a rep’s full ERP book in the admin Owner filter by matching login aliases and ERP sales owner, without changing Tanishq’s identity path. | [preview](https://connect-intel-1j963m7ty-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- cc694f4` |
| 17/09/2026, 16:26:13 | `a0f6855` | Record production LIVE snapshot for ERP last-shipment stage persist. | [preview](https://connect-intel-kcj1zeut6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a0f6855` |
| 17/09/2026, 16:24:48 | `df689b0` | Persist ERP last-shipment pipeline stages on load so existing leads recategorize without overwriting a rep’s manual stage. | [preview](https://connect-intel-gya661ipi-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- df689b0` |
| 17/09/2026, 16:06:20 | `153bc38` | Record production LIVE snapshot for Last shipment filter pills. | [preview](https://connect-intel-kkvez49vw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 153bc38` |
| 17/09/2026, 16:05:09 | `2d02dd5` | Match Last shipment year and month to the other pipeline filter pills. | [preview](https://connect-intel-3fl582gk5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2d02dd5` |
| 17/09/2026, 15:50:35 | `514dae9` | Record production LIVE snapshot for ERP rep identity pipeline visibility. | [preview](https://connect-intel-90wxl3y9n-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 514dae9` |
| 17/09/2026, 15:48:10 | `ec6cb26` | Let CRM reps see ERP-owned leads across invite and login user ids. | [preview](https://connect-intel-8jjirrggf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ec6cb26` |
| 17/09/2026, 15:22:03 | `8ede71f` | Record production LIVE snapshot for ERP rep lead claim. | [preview](https://connect-intel-jwl6958vb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8ede71f` |
| 17/09/2026, 15:19:33 | `85db860` | Assign ERP-owned leads to the signed-in rep so newly added teammates like Tanishq see their book. | [preview](https://connect-intel-kg2oymjg0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 85db860` |
| 17/09/2026, 15:03:51 | `140bef9` | Record production LIVE snapshot for ERP pipeline stage classification. | [preview](https://connect-intel-2gvfa92y0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 140bef9` |
| 17/09/2026, 15:02:38 | `90a27ea` | Classify ERP-imported pipeline stages from last shipment and balance, without overwriting a rep’s manual move. | [preview](https://connect-intel-1ort39tzj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 90a27ea` |
| 17/09/2026, 14:56:41 | `6703c6d` | Record production LIVE snapshot for ERP owner lead assignment. | [preview](https://connect-intel-zkjmnmllm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6703c6d` |

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
