# Chrome Web Store — Privacy tab (copy-paste)

Open: **Build → Privacy** for Connect Intel.

---

## Single purpose description

```
This extension is a companion for Connect Intel CRM customers. It helps sales teams match Gmail threads to CRM leads, sync email activity, capture LinkedIn profiles into the pipeline, and compose CRM emails — only for users signed in to connectintel.net.
```

---

## Permission justifications

### activeTab
```
When the user opens the toolbar popup, read the current tab URL/title to offer "Add to pipeline" on contact-rich pages they are viewing.
```

### cookies
```
Read the connect_intel_session cookie from connectintel.net so the signed-in user can call Connect Intel APIs with the same session as the web app (no separate extension login).
```

### storage
```
Store minimal extension UI preferences only. CRM lead data is not persisted in local storage; it stays on Connect Intel servers.
```

### scripting
```
Inject content scripts on Gmail, LinkedIn, and pages the user visits so the floating CRM widget and Gmail participant extraction run only when those sites are open.
```

### tabs
```
Reload Gmail tabs after an extension update so users get the latest content scripts without manually restarting Chrome.
```

### Host permission use
```
connectintel.net — CRM APIs (lead match, capture, email draft/send, audit log). mail.google.com — Gmail thread widget. linkedin.com — profile capture. Other https pages — optional contact-page capture when the user clicks Add to pipeline.
```

### Remote code use
```
The extension does not download or execute remote JavaScript. It only calls HTTPS JSON APIs on connectintel.net using the user's existing web-app session. All business logic runs on Connect Intel servers.
```

---

## Privacy policy URL

```
https://connectintel.net/privacy.html
```

---

## Certification

Check: **I certify that my data use complies with the Developer Program Policy**

---

## Data practices

| Type | Collected | Purpose |
|------|-----------|---------|
| Authentication information | Yes | Session with Connect Intel |
| Personally identifiable information | Yes | Email addresses on open Gmail threads for lead matching |
| User activity | Yes | Extension actions logged to workspace audit trail |
| Website content | Yes | LinkedIn/contact metadata when user chooses to capture |

**Not sold to third parties.**
