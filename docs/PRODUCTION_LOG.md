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
npm run prod:rollback -- 6376deb
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
| Commit | `548cdb9` |
| Log updated (IST) | 01/07/2026, 23:23:03 |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
| 01/07/2026, 23:22:53 | `548cdb9` | Add enterprise architecture documentation and constitution gap analysis. | [preview](https://connect-intel-4rwq4ysnw-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 548cdb9` | **← LIVE**
| 01/07/2026, 23:12:58 | `6376deb` | Update production log after rep and solo dashboard deploy. | [preview](https://connect-intel-d9uf4ekp2-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 6376deb` |
| 01/07/2026, 23:12:04 | `9ea5b20` | Give reps and solo users the enterprise home dashboard. | [preview](https://connect-intel-m36y6tpey-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9ea5b20` |
| 01/07/2026, 23:08:47 | `70c758b` | Update production log after P2 enterprise dashboard deploy. | [preview](https://connect-intel-9vl6v2nit-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 70c758b` |
| 01/07/2026, 23:07:49 | `b3264c7` | Add enterprise dashboard P2: customizable widgets, live pulse, and Opportunities hub. | [preview](https://connect-intel-2j8yne4um-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- b3264c7` |
| 01/07/2026, 22:58:42 | `74ee142` | Update production log after enterprise dashboard UI deploy. | [preview](https://connect-intel-694ra8jbd-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 74ee142` |
| 01/07/2026, 22:57:59 | `45b3250` | Upgrade home dashboard to enterprise CRM layout and UX. | [preview](https://connect-intel-bedfdcaex-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 45b3250` |
| 01/07/2026, 22:36:20 | `33f9985` | Update production log after enterprise dashboard deploy. | [preview](https://connect-intel-fq1qraxam-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 33f9985` |
| 01/07/2026, 22:35:36 | `ccd8fd6` | Align manager dashboard with enterprise snapshot architecture. | [preview](https://connect-intel-mok8r1neh-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ccd8fd6` |
| 01/07/2026, 22:17:30 | `54a9de5` | Update production log after P1 RBAC and bootstrap deploy. | [preview](https://connect-intel-1098jjnyl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 54a9de5` |
| 01/07/2026, 22:16:39 | `d55cdf7` | Enforce P1 RBAC and speed up pipeline bootstrap for new orgs. | [preview](https://connect-intel-gsyppqixe-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- d55cdf7` |
| 01/07/2026, 22:07:52 | `ece83c5` | Update production log after multi-tenant RBAC deploy. | [preview](https://connect-intel-h3x19mm6i-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- ece83c5` |
| 01/07/2026, 22:06:56 | `69e268e` | Enforce multi-tenant CRM RBAC and org-scoped master data. | [preview](https://connect-intel-ljlmhrznl-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 69e268e` |
| 01/07/2026, 21:54:37 | `9af7286` | Update production log after CRM boot performance deploy. | [preview](https://connect-intel-edxmz7hu3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 9af7286` |
| 01/07/2026, 21:53:40 | `8502312` | Speed up CRM boot with parallel loads and lighter store paths. | [preview](https://connect-intel-gjj3gfxle-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8502312` |
| 01/07/2026, 16:24:43 | `c15fc1a` | Update production log after Google login tab deploy. | [preview](https://connect-intel-rnrsk6euj-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- c15fc1a` |
| 01/07/2026, 16:23:37 | `4f56ffc` | Restore Google sign-in on auth login tab for existing workspaces. | [preview](https://connect-intel-ay8jua9zf-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 4f56ffc` |
| 01/07/2026, 16:10:25 | `8f6e7e6` | Update production log after landing page redesign deploy. | [preview](https://connect-intel-46mskutkg-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 8f6e7e6` |
| 01/07/2026, 16:09:27 | `701ef11` | Redesign landing page with clearer CRM context for new and returning users. | [preview](https://connect-intel-9c5bq0pri-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 701ef11` |
| 01/07/2026, 16:00:25 | `89d2f20` | Update production log after email-auth and free-tier deploy. | [preview](https://connect-intel-8ig776ol3-nee9raj-hues-projects.vercel.app) | `npm run prod:rollback -- 89d2f20` |

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
