# Chrome Web Store — Connect Intel extension v1.0

**Extension package:** `extension/` (Manifest V3)  
**Production API:** https://connectintel.net  
**Privacy:** https://connectintel.net/privacy.html  
**Support:** invite@connectintel.net

---

## Status

| Item | State |
|------|--------|
| Extension v1.0 code | ✅ Ready (`manifest` version `1.0.0`) |
| Store listing copy | ✅ `extension/store/LISTING.md` |
| Privacy policy (extension section) | ✅ `frontend/public/privacy.html` |
| Package script | ✅ `npm run extension:package` |
| **Published on Chrome Web Store** | ⏳ **You upload** (see below) |

The extension is **not** auto-published by CI. A team member with a Chrome Web Store developer account uploads the zip and completes the dashboard review.

---

## One-time: Chrome Web Store developer account

1. Open https://chrome.google.com/webstore/devconsole  
2. Pay the **one-time $5** developer registration fee (if not already registered).  
3. Verify identity / publisher name (**Connect Intel** or your legal entity).  
4. Link **https://connectintel.net** in Search Console (same as Google OAuth verification).

---

## Build the upload zip

From repo root:

```bash
npm run extension:verify
npm run extension:package
```

Output: `dist/connect-intel-chrome-extension-1.0.0.zip`

The zip contains `manifest.json` at the **root** (required by Google).

---

## Upload & publish

1. Developer Dashboard → **New item** → upload `dist/connect-intel-chrome-extension-*.zip`.  
2. Copy fields from **`extension/store/LISTING.md`**:
   - Short + detailed description  
   - Category: **Productivity**  
   - Privacy policy URL  
   - Single purpose + permission justifications  
   - Screenshots (1280×800 recommended)  
3. **Privacy practices** tab — declare data types per LISTING.md.  
4. **Distribution** — Public (or Unlisted for pilot; Public for all orgs).  
5. **Regions** — all regions where Connect Intel sells, or Worldwide.  
6. Submit for review (typically **1–3 business days**; Gmail-related extensions may take longer).

After approval, copy the public URL (`https://chromewebstore.google.com/detail/...`) into:

- `extension/README.md`  
- Team onboarding / `GO-LIVE-EVERYONE.md`  
- Optional: in-app link in Team settings

---

## Relationship to Google OAuth / CASA

| Topic | Notes |
|-------|--------|
| **Chrome Web Store review** | Separate from Google Cloud OAuth verification. |
| **Extension OAuth** | Extension does **not** use its own OAuth client — it uses the `connect_intel_session` cookie from connectintel.net. |
| **Gmail API** | Trail sync and send run **on the server** with OAuth the user grants in the web app (Team → CRM email). |
| **CASA Tier 2** | Still required for **restricted Gmail scopes** on the web app (`gmail.send`, etc.). See `docs/GOOGLE_CASA_AND_VERIFICATION.md`. |
| **Store + CASA** | Publishing the extension does not replace CASA; both can proceed in parallel. |

Update the CASA / Verification Center materials to mention the Chrome extension as an optional install path for the same web-app OAuth (see `extension/store/LISTING.md` reviewer notes).

---

## Versioning after v1.0

1. Bump `version` in `extension/manifest.json` (semver: `1.0.1`, `1.1.0`, …).  
2. `npm run extension:verify && npm run extension:package`  
3. Upload new zip in Developer Dashboard → **Package** → new version.  
4. Submit for review if permissions changed; otherwise many updates are expedited.

---

## Org rollout (after store listing is live)

Share with customers:

1. Install from Chrome Web Store: `[STORE URL]`  
2. Sign in at https://connectintel.net (same Chrome profile).  
3. Connect work Gmail in Team settings (for send / trail sync).  
4. Open Gmail or LinkedIn — use the floating Connect Intel button.

Developer / unpacked install remains available for internal QA (`extension/README.md`).

---

## Checklist before submit

- [ ] `npm run extension:verify` passes  
- [ ] `npm run extension:package` produces zip  
- [ ] `API_BASE` is `https://connectintel.net` in `extension/lib/api.js`  
- [ ] Privacy policy live and includes Chrome extension section  
- [ ] Screenshots captured  
- [ ] Test account credentials prepared for reviewers  
- [ ] Publisher domain verified in Search Console  
- [ ] CASA / OAuth verification in progress (for full Gmail OAuth to all users)

---

## Related

- [CHROME_EXTENSION.md](./CHROME_EXTENSION.md) — architecture & constitution  
- [extension/README.md](../extension/README.md) — features & dev install  
- [GOOGLE_CASA_AND_VERIFICATION.md](./GOOGLE_CASA_AND_VERIFICATION.md) — OAuth + CASA  
- [extension/store/LISTING.md](../extension/store/LISTING.md) — copy-paste store text
