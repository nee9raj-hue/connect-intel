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
npm run prod:rollback -- 485fc4a
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
| Commit | `4c0640e` |
| Log updated (IST) | 21/09/2026, 11:42:22 |

---

## Safe restore codes

These are exact production builds to restore if a later change goes wrong. Tell the assistant the **code** (for example `S-2EA18A4`).

| Code | Commit | Note | Recorded (IST) | Restore |
|------|--------|------|----------------|---------|
| `S-4C0640E` | `4c0640e` | 4c0640e | 21/09/2026, 14:22:07 | `npm run prod:rollback -- S-4C0640E` |
| `S-485FC4A` | `485fc4a` | 485fc4a | 21/09/2026, 11:40:58 | `npm run prod:rollback -- S-485FC4A` |
| `S-2C53FBD` | `2c53fbd` | 2c53fbd | 21/09/2026, 10:52:23 | `npm run prod:rollback -- S-2C53FBD` |
| `S-66F9509` | `66f9509` | 66f9509 | 21/09/2026, 10:00:37 | `npm run prod:rollback -- S-66F9509` |
| `S-2EA18A4` | `2ea18a4` | 2ea18a4 | 21/09/2026, 00:41:11 | `npm run prod:rollback -- S-2EA18A4` |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 21/09/2026, 11:42:10 | `4c0640e` | Load a teammate's full Pipeline when filtering by that team's tag. | [preview](https://connect-intel-cic55cjdt-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4c0640e` | **← LIVE**
| 21/09/2026, 10:53:33 | `485fc4a` | Keep the Non Large B2B tag selected after Apply in More filters. | [preview](https://connect-intel-21ekd4qyd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 485fc4a` |
| 21/09/2026, 10:16:48 | `2c53fbd` | Show a team's full Pipeline when members filter by that team's tag. | [preview](https://connect-intel-evsoej3m4-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2c53fbd` |
| 21/09/2026, 00:42:07 | `66f9509` | Align Pipeline board with combined CRM+ERP stages and add restore codes. | [preview](https://connect-intel-g23l28b2e-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 66f9509` |
| 21/09/2026, 00:27:36 | `2ea18a4` | Fix Pipeline board crash from a missing status helper. | [preview](https://connect-intel-5jtilj2p7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 2ea18a4` |
| 21/09/2026, 00:11:13 | `5b9bf74` | Show last-30-day deal chips next to Last shipment on Pipeline. | [preview](https://connect-intel-ktlrml8q9-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 5b9bf74` |
| 20/09/2026, 11:05:42 | `d3b3269` | Fix Pipeline crash from a missing row-actions import. | [preview](https://connect-intel-plbxm5r2h-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d3b3269` |
| 20/09/2026, 11:01:57 | `843f8e6` | Stop the Pipeline update loop by turning off auto-reload and the service worker. | [preview](https://connect-intel-a3gvs2gtq-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 843f8e6` |
| 20/09/2026, 10:54:31 | `b5a1e6b` | Recover Pipeline after deploys instead of leaving a stale PWA cache wall. | [preview](https://connect-intel-mq5smh0y0-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b5a1e6b` |
| 20/09/2026, 10:35:46 | `d13b82e` | Record production snapshot a69703d as LIVE. | [preview](https://connect-intel-efdkmx4td-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d13b82e` |
| 20/09/2026, 10:34:33 | `a69703d` | Keep Pipeline header filters from wiping other applied filters. | [preview](https://connect-intel-bcl9q1fec-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a69703d` |
| 20/09/2026, 10:26:36 | `01d55d3` | Stop Pipeline from hanging on bootstrap timeout after a cache miss. | [preview](https://connect-intel-qxw69dyk7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 01d55d3` |
| 20/09/2026, 10:14:27 | `78cee03` | Add multi-select filters on Pipeline column headers for status, tags, last shipment, and notes. | [preview](https://connect-intel-8izw8k55o-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 78cee03` |
| 20/09/2026, 09:53:13 | `e01c463` | Ship pipeline filter updates: drop top-bar duplicates, multi-month last shipment, and CRM stages that union with ERP filters. | [preview](https://connect-intel-g35mnjrmu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e01c463` |
| 20/09/2026, 09:20:34 | `69cc6ab` | Show ERP pipeline stages as read-only CRM tags and include them in the ERP tags filter. | [preview](https://connect-intel-qg5s0gha7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 69cc6ab` |
| 20/09/2026, 02:41:09 | `b461714` | Open combined Pipeline on click and show CRM vs ERP stages on hover. | [preview](https://connect-intel-er3e0tnfs-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b461714` |
| 20/09/2026, 02:35:32 | `4fc27fe` | Show combined All leads on Pipeline hover and add ERP tags to the top filters. | [preview](https://connect-intel-lsmpd210u-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4fc27fe` |
| 20/09/2026, 02:21:41 | `25a6db5` | Show separate CRM and ERP pipelines and read ERP tags from revenue.tags. | [preview](https://connect-intel-irujgwwm6-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 25a6db5` |
| 20/09/2026, 02:06:43 | `0f1004d` | Keep read-only ERP tag chips off CRM tagIds on list and workspace refresh. | [preview](https://connect-intel-hv44w7eb3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 0f1004d` |
| 20/09/2026, 02:00:22 | `d2726dc` | Show read-only ERP tags separately from CRM tagIds. | [preview](https://connect-intel-qcmtpoejk-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d2726dc` |

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
