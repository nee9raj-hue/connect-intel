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
npm run prod:rollback -- 6fe3ad4
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
| Commit | `0d8c71f` |
| Log updated (IST) | 06/06/2026, 15:55:56 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 06/06/2026, 15:55:38 | `0d8c71f` | Fix CRM pipeline visibility, calendar sharing, and tracked bulk email. | [preview](https://connect-intel-ggu7547fe-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0d8c71f` | **← LIVE**
| 04/06/2026, 16:19:38 | `6fe3ad4` | Add in-panel Marketing guide with animated UI walkthroughs. | [preview](https://connect-intel-o2osyg2al-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6fe3ad4` |
| 04/06/2026, 16:12:41 | `f70ea0d` | Fix Stop/Pause when campaign status disagrees with enrollment queue. | [preview](https://connect-intel-768e71nrl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f70ea0d` |
| 04/06/2026, 16:08:37 | `b70745d` | Deploy campaign Stop/Pause controls with visible action buttons. | [preview](https://connect-intel-l8kq09kni-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b70745d` |
| 04/06/2026, 14:57:27 | `307eab9` | Add Mailchimp-style campaign reports with archive and date filters. | [preview](https://connect-intel-i8oo9w6ka-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 307eab9` |
| 04/06/2026, 14:40:54 | `9663b74` | Fix campaign reports list when overview loads without pipeline. | [preview](https://connect-intel-ch7340swr-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9663b74` |
| 04/06/2026, 13:24:15 | `05245ab` | Fix campaign reports list to match enrollment engagement. | [preview](https://connect-intel-hho3nzfp9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 05245ab` |
| 04/06/2026, 13:20:50 | `64d3606` | Update production log after campaign reporting deploy. | [preview](https://connect-intel-kh94m7ln0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 64d3606` |
| 04/06/2026, 13:20:05 | `dc1f861` | Polish campaign report KPI labels and show creator on team view. | [preview](https://connect-intel-e4dg8evzc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- dc1f861` |
| 04/06/2026, 12:17:57 | `9027bfc` | Update production log after bulk email fix deploy. | [preview](https://connect-intel-c4ck1a6yq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9027bfc` |
| 04/06/2026, 12:17:10 | `10607e4` | Fix bulk email crash, 100-lead cap, and per-recipient name personalization. | [preview](https://connect-intel-4yrhwngeq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 10607e4` |
| 02/06/2026, 13:55:02 | `754c59b` | Update production log after immersive canvas scroll deploy. | [preview](https://connect-intel-dbql6lq7d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 754c59b` |
| 02/06/2026, 13:54:07 | `48b1a9c` | Fix immersive canvas trackpad scrolling over email content. | [preview](https://connect-intel-6l1vhq3jc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 48b1a9c` |
| 02/06/2026, 13:48:02 | `c945911` | Update production log after vertical scroll fix deploy. | [preview](https://connect-intel-q5kaslgq3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c945911` |
| 02/06/2026, 13:47:13 | `d473b21` | Fix campaign/template canvas vertical scrolling on touch devices. | [preview](https://connect-intel-8vezmb2vs-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d473b21` |
| 02/06/2026, 13:43:05 | `e271351` | Update production log after canvas scrolling deploy. | [preview](https://connect-intel-dcrslhrv7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e271351` |
| 02/06/2026, 13:42:08 | `dfec7e6` | Improve campaign/template canvas scrolling and rail usability. | [preview](https://connect-intel-4u0n2knkv-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- dfec7e6` |
| 01/06/2026, 12:46:43 | `6512225` | chore: sync production log after 44a2b25 deploy. | [preview](https://connect-intel-cdpy8t7fa-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6512225` |
| 01/06/2026, 12:45:58 | `44a2b25` | Speed up pipeline lead assignment after shard PATCH fix. | [preview](https://connect-intel-5fckfc67e-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 44a2b25` |
| 01/06/2026, 12:39:14 | `46ef252` | Update production log after pipeline timeout fix deploy. | [preview](https://connect-intel-3ngx2syyf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 46ef252` |

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
