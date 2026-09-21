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
npm run prod:rollback -- 25e05c2
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
| Commit | `311ae71` |
| Log updated (IST) | 21/09/2026, 19:04:01 |

---

## Safe restore codes

These are exact production builds to restore if a later change goes wrong. Tell the assistant the **code** (for example `S-2EA18A4`).

| Code | Commit | Note | Recorded (IST) | Restore |
|------|--------|------|----------------|---------|
| `S-485FC4A` | `485fc4a` | 485fc4a | 21/09/2026, 11:40:58 | `npm run prod:rollback -- S-485FC4A` |
| `S-2C53FBD` | `2c53fbd` | 2c53fbd | 21/09/2026, 10:52:23 | `npm run prod:rollback -- S-2C53FBD` |
| `S-66F9509` | `66f9509` | 66f9509 | 21/09/2026, 10:00:37 | `npm run prod:rollback -- S-66F9509` |
| `S-2EA18A4` | `2ea18a4` | 2ea18a4 | 21/09/2026, 00:41:11 | `npm run prod:rollback -- S-2EA18A4` |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 21/09/2026, 19:03:35 | `311ae71` | Clear leftover app cache so the restored CRM can fetch again. | [preview](https://connect-intel-9efzb9qem-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 311ae71` | **← LIVE**
| 21/09/2026, 18:54:23 | `25e05c2` | Record production LIVE at the restored 4c0640e snapshot. | [preview](https://connect-intel-ha14sol5w-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 25e05c2` |
| 21/09/2026, 18:52:47 | `b75be84` | Restore production to the 4c0640e working snapshot. | [preview](https://connect-intel-h5xf8or7t-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b75be84` |
| 21/09/2026, 18:14:49 | `153ea47` | Record production LIVE at 7274334. | [preview](https://connect-intel-1u1z5jgm4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 153ea47` |
| 21/09/2026, 18:13:49 | `7274334` | Stop the workspace spinner from waiting forever after Google sign-in. | [preview](https://connect-intel-lb7aph9mm-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7274334` |
| 21/09/2026, 18:10:38 | `222c7d6` | Record production LIVE at f729182. | [preview](https://connect-intel-iguvi8bn4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 222c7d6` |
| 21/09/2026, 18:06:12 | `f729182` | Record production LIVE at 30191ad. | [preview](https://connect-intel-ecofq9930-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- f729182` |
| 21/09/2026, 18:05:00 | `30191ad` | Stop sign-in from aborting as a timeout and give Pipeline more time to load. | [preview](https://connect-intel-9slthx421-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 30191ad` |
| 21/09/2026, 17:55:06 | `91af4cd` | Record production LIVE at 007f74d. | [preview](https://connect-intel-9xg7anqbb-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 91af4cd` |
| 21/09/2026, 17:53:47 | `007f74d` | Record production LIVE at df78703. | [preview](https://connect-intel-3yjorsay1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 007f74d` |
| 21/09/2026, 17:52:29 | `df78703` | Drop the stale cached sign-in app and restore the real Xindus Google user. | [preview](https://connect-intel-gazrnsvcl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- df78703` |
| 21/09/2026, 17:07:42 | `77c01e8` | Record production LIVE at 1dd93e7 after the Google sign-in deploy. | [preview](https://connect-intel-hymdwh3bq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 77c01e8` |
| 21/09/2026, 17:05:59 | `1dd93e7` | Unstick Google sign-in on crm.xindus.net from a stale cached app and personal Gmail. | [preview](https://connect-intel-qpuwpdb3z-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 1dd93e7` |
| 21/09/2026, 16:56:27 | `0c31b47` | Fix Google sign-in on crm.xindus.net instead of the Microsoft SSO path. | [preview](https://connect-intel-jbodjd58j-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0c31b47` |
| 21/09/2026, 16:45:34 | `6fae73d` | Look up Xindus sign-in by exact work email and skip the hanging user-list fallback. | [preview](https://connect-intel-k3wq3wr44-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6fae73d` |
| 21/09/2026, 16:39:19 | `eb12f76` | Return Microsoft sign-in to crm.xindus.net with the session instead of leaving it on connectintel.net. | [preview](https://connect-intel-a3yet3cjs-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- eb12f76` |
| 21/09/2026, 16:29:28 | `d0a7300` | Do not let a users-blob scan hang sign-in after a profiles miss. | [preview](https://connect-intel-5aj8ds3c4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d0a7300` |
| 21/09/2026, 16:27:24 | `547910f` | Scan the users table by email when profiles misses an existing Xindus login. | [preview](https://connect-intel-8kf6f1pi1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 547910f` |
| 21/09/2026, 16:23:22 | `8227d6d` | Look up Xindus accounts in the login store when they are missing from profiles. | [preview](https://connect-intel-2a4ydkvx2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8227d6d` |
| 21/09/2026, 16:18:20 | `e453adb` | Stop sign-in from probing every Postgres host and scanning the users blob. | [preview](https://connect-intel-app7xlnfa-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e453adb` |

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
| `npm run prod:rollback -- <commit-or-safe-code>` | Point production domain at that deployment |
| `npm run prod:ship` | Pre-flight checks before pushing to `main` |
| `npm run prod:verify` | Build + verify critical files only |
| `npm run prod:tag -- [commit]` | Git tag for a known-good production commit |
| `npm run prod:safe` | Snapshot the current LIVE CRM as a restore code before a risky change |

---

*Auto-generated by `scripts/production-log.mjs markdown`. Edit notes in `docs/production-log.json` only.*
