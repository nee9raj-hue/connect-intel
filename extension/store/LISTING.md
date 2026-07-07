# Chrome Web Store listing copy — Connect Intel v1.0

Use this text in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).  
After the first upload, add the public URL to `extension/README.md` and team onboarding docs.

---

## Store fields

| Field | Value |
|-------|-------|
| **Name** | Connect Intel |
| **Category** | Productivity |
| **Language** | English |
| **Homepage** | https://connectintel.net |
| **Privacy policy** | https://connectintel.net/privacy.html |
| **Support email** | invite@connectintel.net |
| **Official URL** | https://connectintel.net (verify domain in Search Console) |

### Short description (≤132 characters)

```
CRM companion for Gmail & LinkedIn — match pipeline leads, sync trails, capture profiles, draft & send from CRM.
```

### Detailed description

```
Connect Intel is the browser companion for customers of Connect Intel CRM (https://connectintel.net).

Requires an active Connect Intel account. Sign in on connectintel.net in the same Chrome profile, then use this extension on Gmail and LinkedIn.

GMAIL
• Match the open email thread to a pipeline lead in your workspace
• Sync the email trail (server-side, workspace-scoped)
• Generate AI email drafts and send from your connected work Gmail
• Log outbound mail to the lead record automatically

LINKEDIN
• Add a profile or company page to your pipeline with one click
• Audited capture — all logic runs on Connect Intel servers

PRIVACY & SECURITY
• Thin client: CRM data stays on Connect Intel servers, not in the extension
• Uses your existing Connect Intel session (no separate extension login)
• Participant emails on the visible Gmail thread are sent only to match leads you already have access to
• See https://connectintel.net/privacy.html

Support: invite@connectintel.net
```

---

## Single purpose

```
This extension is a companion for Connect Intel CRM customers. It helps sales teams match Gmail threads to CRM leads, sync email activity, capture LinkedIn profiles into the pipeline, and compose CRM emails — only for users signed in to connectintel.net.
```

---

## Permission justifications (review form)

| Permission | Why |
|------------|-----|
| **cookies** | Read the `connect_intel_session` cookie from connectintel.net so the signed-in user can call Connect Intel APIs securely (same session as the web app). |
| **storage** | Store minimal extension preferences only; no CRM data is persisted locally. |
| **activeTab** | When the user opens the toolbar popup on a generic page, read the current tab to offer “Add to pipeline”. |
| **scripting** | Inject the Gmail participant extractor on user action / matched pages only. |
| **tabs** | Reload Gmail tabs after an extension update so the latest content scripts load. |
| **connectintel.net** | All CRM APIs (lead match, capture, email draft/send, audit log). |
| **mail.google.com** | Floating widget on Gmail to match threads and trigger trail sync / compose. |
| **linkedin.com** | Capture widget on `/in/` profile pages the user visits. |

---

## Data use (Chrome Web Store “Privacy practices”)

Declare in the dashboard (align with privacy policy):

| Data type | Collected | Purpose |
|-----------|-----------|---------|
| Authentication information | Yes | Session with Connect Intel |
| Personally identifiable information | Yes | Email addresses visible on open Gmail thread for lead matching |
| User activity | Yes | Extension actions logged to workspace audit trail |
| Website content | Yes | LinkedIn profile metadata user chooses to capture |

**Not sold to third parties.** Data processed per https://connectintel.net/privacy.html and Google API Services User Data Policy (Limited Use).

---

## Screenshots (required)

Capture at **1280×800** or **640×400** (PNG):

1. Gmail thread with lead matched + floating Connect Intel panel
2. “Send from CRM” compose with AI draft
3. LinkedIn profile with “Add to pipeline” widget
4. Extension popup signed in

Save under `extension/store/screenshots/` for the team asset library (not bundled in the zip).

---

## Reviewer notes (optional field in dashboard)

```
Test account: [provide a Connect Intel test user email + password or Google test account]

Steps:
1. Sign in at https://connectintel.net
2. Open Gmail thread with a pipeline lead (or use popup on LinkedIn /in/ profile)
3. Click the orange Connect Intel floating button → Sync email trail / Generate draft

OAuth: Extension uses the web app session cookie only. Gmail send/read uses server-side OAuth already granted in Connect Intel Team settings — not a separate extension OAuth client.

Privacy: https://connectintel.net/privacy.html (Chrome extension section)
```

Replace bracketed test credentials before submit.
