# CRM email strategy — early stage (CASA deferred)

**Status:** Active as of July 2026  
**Production:** https://connectintel.net

Connect Intel is **not pursuing CASA Tier 2** at this stage (cost). Restricted Gmail scopes are **removed from the web OAuth app** until the product can support the assessment.

---

## What reps use today

| Need | Path |
|------|------|
| **Sign in** | Work email + password, or Google **sign-in only** (`openid`, `email`, `profile`) |
| **Send email + log to CRM** | **Chrome extension** in Gmail (`Send & log`) or org **Resend** domain when configured |
| **Reply sync** | **Inbound routing** (`inbound.connectintel.net`) — no `gmail.readonly` |
| **Trail / thread sync** | **Chrome extension** → `POST /api/crm/sync-email-thread` (matched lead only) |
| **Manual fallback** | Lead → Email tab → **Log reply** |

---

## What is deferred

| Item | Why |
|------|-----|
| **CASA Tier 2** | ~$4.5k–$15k+ lab fee; not justified at early revenue |
| **`gmail.send` on web OAuth** | Restricted scope → requires verification + CASA for all users |
| **`gmail.readonly`** | Already removed; replaced by inbound reply sync |

---

## Google Cloud Console (current)

**OAuth consent screen — scopes in use:**

- `openid`, `email`, `profile` — identity / sign-in
- Do **not** add `gmail.send` or `gmail.readonly` until CASA is funded

**Optional later (separate connect step, still needs CASA for production):**

- `calendar.events` — CRM calendar push (sensitive, not restricted like Gmail)

---

## Chrome extension role

The extension is the **primary Gmail integration** until web OAuth is restored:

1. Install from Chrome Web Store (same Chrome profile as connectintel.net login)
2. Open Gmail → floating Connect Intel widget
3. **Lead match** — participant emails vs pipeline (RBAC-scoped)
4. **Trail sync** — server pulls only CRM-linked thread mail (no bulk inbox)
5. **Send & log** — requires rep to have connected work Gmail when `GOOGLE_OAUTH_ALLOW_CONNECT=true` + test user, **or** org Resend sending

See `extension/README.md` and `docs/CHROME_WEB_STORE.md`.

---

## When to revisit CASA

- Paying teams depend on **in-app** Gmail connect (no extension)
- Marketing bulk send from personal Gmail at scale
- Google threatens scope revocation on a scope you still need

Until then: reply to Google that restricted scopes are **removed** and the app uses extension + inbound email for CRM sync.

---

## Related docs

- `docs/CRM_INBOUND_EMAIL.md` — reply routing without inbox read
- `docs/GOOGLE_CASA_AND_VERIFICATION.md` — full CASA process (deferred)
- `docs/CHROME_WEB_STORE.md` — extension publish status
