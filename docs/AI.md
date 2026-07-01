# Connect Intel — AI Capabilities

**Last updated:** 2026-06-24

---

## 1. Overview

AI is embedded across prospecting, email composition, team intelligence, and collaboration. The constitution targets **predictive analytics** and **automated data entry** as a full AI Engine pillar — partially realized today.

---

## 2. AI features (shipped)

| Feature | API | UI |
|---------|-----|-----|
| AI prospect search | `search-leads` | `PeopleSearch` |
| Email generation | `crm/generate-email` | Lead workspace |
| WhatsApp message gen | `crm/generate-whatsapp` | Lead workspace |
| Connect Assistant | `assistant-chat` | `ConnectAssistant` in shell |
| Chithi (team AI chat) | `chithi` | `ChithiPanel` (feature-flagged) |
| Team intelligence insights | `crm/team-metrics` | Dashboard / team panels |
| Admin research leads | `admin-research-leads` | Admin panel |

---

## 3. Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Frontend   │────▶│  Vercel handler │────▶│ LLM provider │
│  (prompt UI) │     │  (server-side)  │     │ OpenAI-compat│
└──────────────┘     └─────────────────┘     └──────────────┘
```

**Principles:**
- API keys **never** exposed to browser
- Prompts constructed server-side with tenant context
- PII minimized in prompts where possible

---

## 4. Feature flags

**File:** `frontend/src/lib/crmProductFlags.js`

Flags can hide AI/credits/Chithi for specific customer go-lives:
- `AI_PROSPECTING_IN_CRM_ENABLED`
- `CHITHI_IN_CRM_ENABLED`
- `CREDITS_IN_CRM_UI_ENABLED`

---

## 5. Data & privacy

| Concern | Mitigation |
|---------|------------|
| Cross-tenant leakage | Handlers use `requireUser` + org scope |
| PII in logs | Avoid logging full prompts in production |
| Google CASA | `GOOGLE_CASA_AND_VERIFICATION.md` |
| User consent | Marketing consent separate from AI |

---

## 6. Credits & billing (partial)

- Credits UI can be hidden via product flags
- Plan limits on `organizations` — enforcement in handlers (varies by feature)

---

## 7. Constitution gaps

| Target | Status |
|--------|--------|
| Predictive lead scoring | Partial (hot score in pipeline) |
| Automated data entry | Partial (import, AI search) |
| Embedded AI on every record | Partial (lead workspace) |
| AI action audit log | ❌ |
| Per-org AI usage metering | ❌ |
| Model routing (OpenAI/Anthropic) | Single-provider pattern |

---

## 8. Configuration

| Env | Purpose |
|-----|---------|
| OpenAI-compatible API key | Search, assistant, email gen |
| Model overrides | Per-handler defaults |

---

## 9. Roadmap

See `PROJECT_ROADMAP.md` Phase 20:
- AI action audit table
- Usage metering per org
- Lead scoring model v2
- Record-level AI suggestions (next best action)

---

## 10. Implementation guidelines

Before adding AI features:
1. Server-side only for LLM calls
2. Permission check (`edit_leads` or feature-specific)
3. Rate limit per user/org
4. Log action metadata (not full prompt) for audit
5. Feature flag for gradual rollout
