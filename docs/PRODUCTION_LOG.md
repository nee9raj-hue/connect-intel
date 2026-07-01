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
npm run prod:rollback -- c15fc1a
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
| Commit | `8502312` |
| Log updated (IST) | 01/07/2026, 21:53:54 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 01/07/2026, 21:53:40 | `8502312` | Speed up CRM boot with parallel loads and lighter store paths. | [preview](https://connect-intel-gjj3gfxle-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8502312` | **← LIVE**
| 01/07/2026, 16:24:43 | `c15fc1a` | Update production log after Google login tab deploy. | [preview](https://connect-intel-rnrsk6euj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c15fc1a` |
| 01/07/2026, 16:23:37 | `4f56ffc` | Restore Google sign-in on auth login tab for existing workspaces. | [preview](https://connect-intel-ay8jua9zf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4f56ffc` |
| 01/07/2026, 16:10:25 | `8f6e7e6` | Update production log after landing page redesign deploy. | [preview](https://connect-intel-46mskutkg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8f6e7e6` |
| 01/07/2026, 16:09:27 | `701ef11` | Redesign landing page with clearer CRM context for new and returning users. | [preview](https://connect-intel-9c5bq0pri-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 701ef11` |
| 01/07/2026, 16:00:25 | `89d2f20` | Update production log after email-auth and free-tier deploy. | [preview](https://connect-intel-8ig776ol3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 89d2f20` |
| 01/07/2026, 15:59:34 | `253962d` | Ship email-only auth, free-tier limits, and admin upgrade flow. | [preview](https://connect-intel-oj6uvx4dp-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 253962d` |
| 01/07/2026, 15:47:34 | `e7615bf` | Remove desktop floating Nav pill; sidebar remains primary navigation. | [preview](https://connect-intel-8ev2cge0d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e7615bf` |
| 01/07/2026, 15:31:17 | `7951641` | Run solo CRM on free infra only: skip crons and paid API paths. | [preview](https://connect-intel-hlqka4ric-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7951641` |
| 01/07/2026, 15:08:07 | `465c54f` | Enforce solo free CRM tier and strip paid plan signals from user sessions. | [preview](https://connect-intel-dl1t6n37r-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 465c54f` |
| 01/07/2026, 15:02:57 | `d1c0373` | Hide subscription UI during CRM go-live and show included workspace tab. | [preview](https://connect-intel-ej9kzk0fv-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d1c0373` |
| 01/07/2026, 14:52:03 | `59e7693` | Focus CRM on core workflow: email signup, no onboarding Gmail prompt. | [preview](https://connect-intel-3ikalathf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 59e7693` |
| 01/07/2026, 14:20:49 | `7012ce7` | Add ops tooling to transfer org admin and demote mistaken first signup. | [preview](https://connect-intel-mocvyr7g7-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 7012ce7` |
| 01/07/2026, 14:11:03 | `63e1480` | Remove Chithi from CRM shell and add per-org CRM clean for go-live. | [preview](https://connect-intel-aidn89hjl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 63e1480` |
| 01/07/2026, 13:54:54 | `339cf57` | Add production fresh-start reset to wipe all org CRM data for go-live. | [preview](https://connect-intel-fpot2yaib-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 339cf57` |
| 30/06/2026, 13:33:55 | `a8f1b6f` | Add bulk pipeline delete so orgs can remove unused leads in batches. | [preview](https://connect-intel-oe0tz2vsg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- a8f1b6f` |
| 30/06/2026, 12:18:11 | `bfe0a22` | Keep owner filter enforced when leads are reassigned in the pipeline list. | [preview](https://connect-intel-nfub5ev6i-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- bfe0a22` |
| 30/06/2026, 12:11:08 | `940b559` | Fix pipeline state/city filters returning empty lists with wrong match counts. | [preview](https://connect-intel-89k7bvymu-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 940b559` |
| 30/06/2026, 12:01:00 | `e999fdb` | Fix assignment emails: proper HTML formatting and one digest per bulk assign. | [preview](https://connect-intel-1xtiqki2n-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- e999fdb` |
| 30/06/2026, 11:47:32 | `29802e9` | Fix pipeline state filter so location and GUJRAT spelling match correctly. | [preview](https://connect-intel-b25fx2h5d-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 29802e9` |

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
