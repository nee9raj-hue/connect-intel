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
npm run prod:rollback -- 45f2088
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
| Commit | `ae6d4ac` |
| Log updated (IST) | 23/09/2026, 18:10:50 |

---

## Safe restore codes

These are exact production builds to restore if a later change goes wrong. Tell the assistant the **code** (for example `S-2EA18A4`).

| Code | Commit | Note | Recorded (IST) | Restore |
|------|--------|------|----------------|---------|
| `S-E332DA2` | `e332da2` | Healthy CRM snapshot before a later change | 23/09/2026, 18:09:10 | `npm run prod:rollback -- S-E332DA2` |
| `S-9904199` | `9904199` | Healthy CRM snapshot before a later change | 23/09/2026, 14:32:30 | `npm run prod:rollback -- S-9904199` |
| `S-5DDADA4` | `5ddada4` | Healthy CRM snapshot before a later change | 23/09/2026, 12:18:31 | `npm run prod:rollback -- S-5DDADA4` |
| `S-202546C` | `202546c` | Healthy CRM snapshot before a later change | 23/09/2026, 11:08:06 | `npm run prod:rollback -- S-202546C` |
| `S-6B439F4` | `6b439f4` | Healthy CRM snapshot before a later change | 23/09/2026, 09:50:48 | `npm run prod:rollback -- S-6B439F4` |
| `S-BE998EC` | `be998ec` | Healthy CRM snapshot before a later change | 23/09/2026, 09:27:01 | `npm run prod:rollback -- S-BE998EC` |
| `S-FE51015` | `fe51015` | Healthy CRM snapshot before a later change | 22/09/2026, 21:41:34 | `npm run prod:rollback -- S-FE51015` |
| `S-EB84C89` | `eb84c89` | Healthy CRM snapshot before a later change | 22/09/2026, 20:55:07 | `npm run prod:rollback -- S-EB84C89` |
| `S-4DB6966` | `4db6966` | Healthy CRM snapshot before a later change | 22/09/2026, 20:26:57 | `npm run prod:rollback -- S-4DB6966` |
| `S-1A915E5` | `1a915e5` | Healthy CRM snapshot before a later change | 22/09/2026, 20:06:42 | `npm run prod:rollback -- S-1A915E5` |
| `S-1CF3E1C` | `1cf3e1c` | Healthy CRM snapshot before a later change | 22/09/2026, 16:18:13 | `npm run prod:rollback -- S-1CF3E1C` |
| `S-311AE71` | `311ae71` | Healthy CRM snapshot before a later change | 22/09/2026, 15:03:28 | `npm run prod:rollback -- S-311AE71` |
| `S-485FC4A` | `485fc4a` | 485fc4a | 21/09/2026, 11:40:58 | `npm run prod:rollback -- S-485FC4A` |
| `S-2C53FBD` | `2c53fbd` | 2c53fbd | 21/09/2026, 10:52:23 | `npm run prod:rollback -- S-2C53FBD` |
| `S-66F9509` | `66f9509` | 66f9509 | 21/09/2026, 10:00:37 | `npm run prod:rollback -- S-66F9509` |
| `S-2EA18A4` | `2ea18a4` | 2ea18a4 | 21/09/2026, 00:41:11 | `npm run prod:rollback -- S-2EA18A4` |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 23/09/2026, 18:10:27 | `ae6d4ac` | Capture courier contracts separately so commercial shipment quotes stay on their own deals list. | [preview](https://connect-intel-ftaxxupa6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ae6d4ac` | **← LIVE**
| 23/09/2026, 14:35:28 | `45f2088` | Record production LIVE at e332da2. | [preview](https://connect-intel-6ams30qce-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 45f2088` |
| 23/09/2026, 14:33:47 | `e332da2` | Load the selected owner's full assigned book when a manager filters Pipeline by owner. | [preview](https://connect-intel-232r6i685-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e332da2` |
| 23/09/2026, 12:21:15 | `e9b1f99` | Record production LIVE at 9904199. | [preview](https://connect-intel-9tdb15vm0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e9b1f99` |
| 23/09/2026, 12:19:45 | `9904199` | Show every assigned lead when Pipeline is opened, including ERP-stage accounts. | [preview](https://connect-intel-f76u6pms9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9904199` |
| 23/09/2026, 11:10:59 | `42d4e46` | Record production LIVE at 5ddada4. | [preview](https://connect-intel-byph6brg0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 42d4e46` |
| 23/09/2026, 11:09:32 | `5ddada4` | Save overview stage changes, show notes on calls and meetings, and sync those meetings to the rep calendar. | [preview](https://connect-intel-ghnlk8ga1-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5ddada4` |
| 23/09/2026, 09:52:43 | `3e97c3b` | Record production LIVE at 202546c. | [preview](https://connect-intel-dhapr8kf8-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3e97c3b` |
| 23/09/2026, 09:51:35 | `202546c` | Remove the ERP Revenue and ERP Finance tabs from the lead record. | [preview](https://connect-intel-m078toltu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 202546c` |
| 23/09/2026, 09:28:53 | `42c167a` | Record production LIVE at 6b439f4. | [preview](https://connect-intel-f8ejpmgq5-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 42c167a` |
| 23/09/2026, 09:27:42 | `6b439f4` | Keep Pipeline owners aligned with the ERP sales owner when that person changes. | [preview](https://connect-intel-pqu3qz5ri-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6b439f4` |
| 22/09/2026, 21:43:32 | `9b9e1ca` | Record production LIVE at be998ec. | [preview](https://connect-intel-axjrkn2f6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9b9e1ca` |
| 22/09/2026, 21:42:24 | `be998ec` | Copy ERP last shipment onto Pipeline even when a duplicate customer row has no date. | [preview](https://connect-intel-nzdr693t7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- be998ec` |
| 22/09/2026, 20:57:09 | `3f8c361` | Record production LIVE at fe51015. | [preview](https://connect-intel-tuyjfr2jg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 3f8c361` |
| 22/09/2026, 20:56:11 | `fe51015` | Open Pipeline after sign-in and save team role changes without rewriting the whole CRM store. | [preview](https://connect-intel-oyq4tnbzo-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- fe51015` |
| 22/09/2026, 20:28:57 | `91b351f` | Record production LIVE at eb84c89. | [preview](https://connect-intel-awc2luqf2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 91b351f` |
| 22/09/2026, 20:27:54 | `eb84c89` | Show Searching while a new Pipeline query runs, and match each word of a company name. | [preview](https://connect-intel-198s4qqlk-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- eb84c89` |
| 22/09/2026, 20:08:53 | `c0628e6` | Record production LIVE at 4db6966. | [preview](https://connect-intel-8wl2sk0ss-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c0628e6` |
| 22/09/2026, 20:07:46 | `4db6966` | Keep Pipeline search results stable across back-to-back queries and assign tags on the fast patch path. | [preview](https://connect-intel-5e5lyi3zk-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4db6966` |
| 22/09/2026, 19:36:26 | `367c6d7` | Record production LIVE at 1a915e5. | [preview](https://connect-intel-1q1llr3rg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 367c6d7` |

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
