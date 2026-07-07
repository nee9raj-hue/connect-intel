# Connect Copilot — Architecture

**Status:** Production orchestration layer (v1)  
**Replaces:** Manual CRM AI / Web research mode toggle  
**Stack:** Existing Vite/React shell · Vercel serverless · `assistantThreads` store

## Mission

Enterprise-grade **sales copilot** inside Connect Intel: answers from CRM + web + product knowledge, with one-click CRM actions — not a generic chatbot.

## Core principles

1. **Autonomous routing** — single input; planner picks CRM search, web, news, knowledge, or combined.
2. **Tenant isolation** — all CRM retrieval respects `pipelineVisibility` and org scope.
3. **RAG split** — retrievers gather facts; synthesizer generates the reply.
4. **Transparency** — source badges + confidence on every answer.
5. **Action-oriented** — navigate, create lead, draft email, schedule meeting, create task.
6. **Observable** — prompt/plan/retrieval logged on thread (`copilotLog`).
7. **Cache** — repeated web queries use `infra/cache.js` (15 min TTL).

## Flow

```
User question + uiContext (panel, tab, leadId)
        ↓
   planner.planCopilotTurn()
        ↓
   Parallel retrievers (CRM facts, FAQ, CRM search, lead context, web)
        ↓
   synthesizer.synthesizeCopilotReply()
        ↓
   actions.buildCopilotActions()
        ↓
   Thread persist + response (reply, sources, confidence, companyCard, actions)
```

## Modules (`lib/server/copilot/`)

| Module | Role |
|--------|------|
| `planner.js` | Intent detection + retrieval plan |
| `retrievers.js` | CRM search, lead load, FAQ/grounded, cached web |
| `synthesizer.js` | Merge retrievals → compact reply + company card |
| `actions.js` | Quick actions from intents + context |
| `contextSuggestions.js` | Panel-aware suggestion chips |
| `cache.js` | Web research cache keys |
| `logger.js` | Thread-scoped copilot audit log |
| `orchestrator.js` | `processCopilotTurn()` entry |

## Knowledge sources (v1)

| Source | Retriever | Badge |
|--------|-----------|-------|
| CRM workspace counts | `tryGroundedWorkspaceReply` | Your workspace |
| Product FAQ | `tryHighConfidenceFaq` | Product guide |
| CRM record search | `searchPlatformFast` | CRM |
| Current lead | `findPipelineEntryAsync` | CRM |
| Web / company / news | `crmAssistantWebResearch` (cached) | Web research |
| LLM synthesis | Anthropic when multi-source | Connect Copilot |

## Security

- CRM search and lead load always through visibility helpers.
- `create_lead` payloads sanitized server-side; client confirms before POST.
- No cross-org data in prompts.
- Web research: B2B only per `ASSISTANT_CONSTITUTION`.

## Frontend

- **Connect Copilot** panel (`ConnectAssistant.jsx`) — single input, no mode toggle.
- `CopilotCompanyCard` — company intel summary when available.
- Context suggestions from `getContextualSuggestions(panel, leadId)`.
- `pipelineLeadId` passed from `AppShell` for lead-scoped answers.

## Future (v2)

- Tool execution: auto-create lead via `persistManualPipelineLead` on confirm.
- Email/calendar tools wired to Gmail APIs.
- Deal forecasting from dashboard snapshots.
- Provider abstraction beyond Perplexity.
