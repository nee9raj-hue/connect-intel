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
npm run prod:rollback -- 1e99102
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
| Commit | `8e8b79f` |
| Log updated (IST) | 30/05/2026, 17:48:55 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 30/05/2026, 17:48:41 | `8e8b79f` | Compact mobile pipeline header and HubSpot filter sheets. | [preview](https://connect-intel-8ut8osdgc-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8e8b79f` | **← LIVE**
| 30/05/2026, 17:42:38 | `6e53d5b` | Update production log after per-icon mobile filter popups deploy. | [preview](https://connect-intel-qpnboa89l-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6e53d5b` |
| 30/05/2026, 17:41:54 | `d05ae11` | Add per-icon full-screen filter popups on mobile and PWA. | [preview](https://connect-intel-pm93hvm53-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d05ae11` |
| 30/05/2026, 17:35:33 | `359ed5b` | Update production log after mobile/PWA leads fixes deploy. | [preview](https://connect-intel-39i8jbqe7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 359ed5b` |
| 30/05/2026, 17:34:41 | `760df41` | Fix mobile leads call icon placement and PWA filter sheet. | [preview](https://connect-intel-dgy6ilxrp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 760df41` |
| 30/05/2026, 17:27:18 | `08b9487` | Update production log after mobile pipeline filters deploy. | [preview](https://connect-intel-iejkg3y45-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 08b9487` |
| 30/05/2026, 17:26:31 | `c32e770` | Add full-screen HubSpot-style lead filters on mobile. | [preview](https://connect-intel-aw0to2vns-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c32e770` |
| 30/05/2026, 17:21:59 | `2848646` | Update production log after safety tooling deploy. | [preview](https://connect-intel-h84wkqgtd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2848646` |
| 30/05/2026, 17:20:57 | `8e02383` | Add production safety: CI gate, deploy verify, and rollback log. | [preview](https://connect-intel-4o0oimmtj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8e02383` |
| 30/05/2026, 17:09:55 | `3db2f52` | Fix marketing Lists filters and simplify Lists tab chrome. | [preview](https://connect-intel-82rrb9bd1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3db2f52` |
| 30/05/2026, 17:00:13 | `1376a3a` | Use branded call icon on pipeline leads for callable numbers only. | [preview](https://connect-intel-f09tsav38-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1376a3a` |
| 30/05/2026, 16:56:00 | `7f1674a` | Fix Chithi module load, call icon, and Chithi menu contrast. | [preview](https://connect-intel-9foq27t4x-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7f1674a` |
| 30/05/2026, 15:18:12 | `1e99102` | Ship local CRM, marketing studio, Chithi, and PWA to production. | [preview](https://connect-intel-g4j1spr4n-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1e99102` |
  - Notes: Known-good baseline: full local CRM, marketing studio, Chithi, PWA (2026-05-30).
| 30/05/2026, 15:08:43 | `53f5c7b` | Restore full Connect Assistant with escalations on all platforms. | [preview](https://connect-intel-7n1si1ypv-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 53f5c7b` |
| 30/05/2026, 14:59:55 | `320116e` | Add VAPID web push support on top of dc93f77 baseline. | [preview](https://connect-intel-qgtt56hyy-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 320116e` |
| 30/05/2026, 14:44:11 | `09320cc` | Restore pre-platform-prompt UI from ff2f4f7 plus recovered editor history. | [preview](https://connect-intel-1v2gid8el-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 09320cc` |
| 30/05/2026, 14:34:23 | `5751735` | Restore yesterday UI from editor history after accidental file loss. | [preview](https://connect-intel-gyt4896bp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5751735` |

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
