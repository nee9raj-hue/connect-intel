# Connect Intel — Security

**Last updated:** 2026-06-24

---

## 1. Security model

Connect Intel is a **multi-tenant B2B SaaS** platform. Security goals align with the engineering constitution:

1. **Tenant isolation** — no cross-org data access
2. **RBAC** — least privilege per role
3. **Authenticated APIs** — no anonymous CRM access
4. **Auditable actions** — sensitive mutations logged
5. **Encryption** — TLS in transit; selective encryption at rest

---

## 2. Authentication

| Mechanism | Implementation |
|-----------|----------------|
| Primary login | Google OAuth (`@react-oauth/google`) |
| Session | JWT signed server-side (`sessionJwt.js`) |
| Transport | httpOnly cookie + `Authorization: Bearer` |
| Client storage | `sessionStorage` key `connect_intel_session` |
| Session cache | Redis/memory (`authSessionCache.js`) |
| Token refresh | `GET/POST /api/auth/session` on 401 |

**Files:** `lib/server/auth.js`, `lib/server/handlers/auth-session.js`, `frontend/src/lib/sessionAuth.js`

### Invite flow

- Invite tokens in URL → `sessionStorage` → accepted on onboarding
- `team/invite`, `invite-accept` handlers

---

## 3. Multi-tenancy enforcement

| Layer | File | Mechanism |
|-------|------|-----------|
| Write guard | `tenantWriteGuard.js` | Stamp `organizationId`; reject cross-tenant |
| Read sanitize | `tenantIsolation.js` | Strip fields; merge for viewer |
| Pipeline visibility | `pipelineVisibility.js` | Rep vs manager scope |
| Manager hierarchy | `pipelineManagerScope.js` | Team subtree owner IDs |
| SQL scope | `pipelineTableScope.js` | `organization_id` / owner filters |
| Marketing scope | `marketingAccess.js` | Org campaigns only |

**Solo accounts:** `pipeline_user_{userId}` shard; full permissions without org matrix.

---

## 4. Role-based access control (RBAC)

### 4.1 Role sources

| Role type | Source |
|-----------|--------|
| Platform admin | `user.isPlatformAdmin` |
| Org admin | `orgRole === 'org_admin'` or `isOrgAdmin` |
| Pipeline manager | `membership.pipelineRole === 'manager'` |
| Pipeline rep | default member |
| Marketing manager / executive | `marketingRole` on membership |

### 4.2 Permission matrix

**File:** `lib/server/rolePermissions.js`  
**SQL:** `role_permissions` table (per-org overrides)  
**Enforcement:** `lib/server/permissionEnforce.js`

| Action | Typical grant |
|--------|---------------|
| `view_all_leads` | manager, admin |
| `edit_leads` | rep+ (own leads fallback) |
| `delete_leads` | manager, admin |
| `export_leads` | manager, admin |
| `manage_team` | admin |
| `access_marketing` | marketing roles, admin |
| `send_campaigns` | marketing manager |
| `view_analytics` | manager, admin |
| `manage_billing` | admin |

### 4.3 Handler enforcement pattern

```javascript
const user = await requireUser(req, res)
if (!user) return
await assertOrgPermission(user, 'edit_leads', store)
// ... business logic
```

**Status:** P0/P1 permissions shipped on key handlers; full audit in progress (`CRM_GAP_ANALYSIS.md`).

---

## 5. API security

| Control | Status |
|---------|--------|
| Auth on protected routes | ✅ Default via `requireUser` |
| CORS | ✅ `applyCors` |
| CSRF | Cookie + SameSite; SPA same-origin |
| Rate limiting | ⚠️ Partial |
| Input validation | Ad hoc per handler |
| SQL injection | Parameterized PostgREST / RPC |
| Cron secret | ✅ `CRON_SECRET` on cron routes |

---

## 6. Encryption

| Data | Protection |
|------|------------|
| In transit | HTTPS (Vercel TLS) |
| Lead PII (enterprise table) | Supabase Vault (`seal_lead_pii`) |
| OAuth tokens | Stored encrypted in user/org records |
| Session JWT | Signed; short TTL |

---

## 7. Audit & logging

| Mechanism | Coverage |
|-----------|----------|
| CRM activity log | User actions on leads |
| Marketing events | Opens, clicks, sends |
| Admin tenant audit | `admin-tenant-audit.js` |
| Sentry | Server exceptions |
| Production log | Deploy audit trail |

**Gap:** Immutable org-wide audit stream for all mutations (constitution requirement).

---

## 8. Compliance & hardening

| Topic | Document |
|-------|----------|
| Google OAuth / CASA | `GOOGLE_CASA_AND_VERIFICATION.md` |
| Platform hardening | `PLATFORM_HARDENING.md` |
| Inbound email privacy | `CRM_INBOUND_EMAIL.md` |

---

## 9. Security checklist (pre-release)

- [ ] All new handlers call `requireUser`
- [ ] Mutations check `assertOrgPermission` where applicable
- [ ] No `organizationId` from client body trusted without verification
- [ ] Cron routes require secret
- [ ] No secrets in client bundle (`public-config` sanitized)
- [ ] Run `npm run prod:ship` before deploy

---

## 10. Incident response

1. Rollback via `npm run prod:rollback -- <commit>` (`PRODUCTION_LOG.md`)
2. Revoke sessions: rotate JWT secret (requires env update + redeploy)
3. Disable compromised OAuth client in Google Cloud Console

---

## 11. Roadmap (security phases)

See `PROJECT_ROADMAP.md` Phases 2, 5, 6, 24:
- Complete RBAC handler audit (P0)
- Global rate limiting (P1)
- Audit event table (P1)
- Penetration test schedule (P2)
