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
npm run prod:rollback -- e0fc2d0
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
| Commit | `50bc205` |
| Log updated (IST) | 09/07/2026, 22:30:01 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 09/07/2026, 22:21:51 | `50bc205` | Add extension v1.3 multi-contact picker for team and directory pages. | [preview](https://connect-intel-4ma2bk145-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 50bc205` | **← LIVE**
| 09/07/2026, 21:46:16 | `e0fc2d0` | Shorten extension manifest description for Chrome Web Store limits. | [preview](https://connect-intel-oyujo0gba-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e0fc2d0` |
| 09/07/2026, 21:42:35 | `c0cd323` | Wire Chrome Web Store URL through public-config and Team Integrations. | [preview](https://connect-intel-6bt4d5lok-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c0cd323` |
| 09/07/2026, 20:53:26 | `29300d9` | Fix account hierarchy sync and add rollup metrics for parent/child accounts. | [preview](https://connect-intel-dema5jukq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 29300d9` |
| 09/07/2026, 20:39:55 | `25b6fb0` | Add first-class Deal API with full CRUD on /api/crm/deals. | [preview](https://connect-intel-j02kq9lhn-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 25b6fb0` |
| 09/07/2026, 20:27:01 | `7337eaf` | Add server-side pipeline CSV export and saved report definitions. | [preview](https://connect-intel-ats0x3cu5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7337eaf` |
| 09/07/2026, 18:08:06 | `b696103` | Document workflow versioning snapshots as shipped for CRM and marketing. | [preview](https://connect-intel-lr9qcaibx-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b696103` |
| 09/07/2026, 18:07:08 | `f09fda9` | Add versioned workflow publish snapshots and run history UI. | [preview](https://connect-intel-n2t7s1m7z-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f09fda9` |
| 09/07/2026, 17:57:54 | `35d242f` | Ship extension v1.2 contact capture, contact dedup merge, and RBAC audit fix. | [preview](https://connect-intel-b4hoa2kh6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 35d242f` |
| 09/07/2026, 13:07:20 | `32fd333` | Fix sidebar pipeline counts staying stale after CRM status changes. | [preview](https://connect-intel-hjf5k2kuu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 32fd333` |
| 09/07/2026, 12:51:24 | `de3c7e8` | Add freight RFQ parsing, logistics intel, and messaging stats to Connect Copilot. | [preview](https://connect-intel-i6ufoa09d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- de3c7e8` |
| 08/07/2026, 17:09:03 | `fc0da17` | Fix CRM bulk email silently dropping all recipients as "no_consent" | [preview](https://connect-intel-g8lj8bzlq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- fc0da17` |
| 08/07/2026, 16:52:09 | `ff130e5` | Unified Enterprise Messaging Engine: queue all sends via worker + shared engine | [preview](https://connect-intel-1tqcc6f1d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ff130e5` |
| 08/07/2026, 16:20:45 | `46335b7` | Update production deploy log for 86660c3 | [preview](https://connect-intel-q8xis78n4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 46335b7` |
| 08/07/2026, 16:15:57 | `86660c3` | Send small CRM bulk emails inline in-request so they no longer stall as "queued" | [preview](https://connect-intel-b2mmtgz2r-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 86660c3` |
| 08/07/2026, 16:05:52 | `91066a8` | Fix bulk emails stuck at "queued" by seeding recipients sync + self-healing drain | [preview](https://connect-intel-1bex98cjf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 91066a8` |
| 08/07/2026, 15:45:21 | `1ca4600` | Stop AI CRM emails fabricating sender claims from the recipient's city. | [preview](https://connect-intel-rkpfhr1b0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1ca4600` |
| 08/07/2026, 14:37:28 | `0c93d77` | Use LinkedIn JSON-LD as authoritative employer/location source for capture. | [preview](https://connect-intel-h9ga0egom-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0c93d77` |
| 08/07/2026, 13:12:54 | `7d4324b` | Stop LinkedIn capture picking a followed company; read employer from Experience. | [preview](https://connect-intel-ih49x9tql-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7d4324b` |

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
