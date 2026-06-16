/** Connect Intel — usage guardrails (shared server + client). */

export const LOST_LEAD_STATUSES = new Set(['lost', 'closed_lost', 'disqualified'])

export const DEFAULT_USAGE_POLICIES = {
  pipelineEmail: { allowMax: 10, guideMax: 50, blockAbove: 50 },
  bulkAssign: { confirmAbove: 100, managerRequiredAbove: 500 },
  bulkEdit: { reviewAbove: 100 },
  export: { instantMax: 500, prepareMax: 5000 },
  meetingsBulkMax: 25,
  searchDebounceMs: 500,
  searchMinLength: 2,
  searchMaxResults: 50,
  dashboardRefreshMinMs: 60_000,
  timelineInitial: 20,
  notesAutosaveMs: 3000,
  roleLimits: {
    rep: { emailMax: 10, exportMax: 500, bulkAssignMax: 100 },
    manager: { emailMax: 50, exportMax: 5000, bulkAssignMax: 500 },
    admin: { emailMax: 200, exportMax: 10_000, bulkAssignMax: 5000 },
  },
}

export function resolveProtectionRole(user) {
  if (!user) return 'rep'
  if (user.isOrgAdmin || user.orgRole === 'org_admin') return 'admin'
  if (user.orgRole === 'manager' || user.orgRole === 'org_manager') return 'manager'
  if (user.pipelineRole === 'manager') return 'manager'
  return 'rep'
}

export function getUsagePolicies(orgCrmSettings) {
  const custom = orgCrmSettings?.usagePolicies
  if (!custom || typeof custom !== 'object') return { ...DEFAULT_USAGE_POLICIES }
  return deepMergePolicies(DEFAULT_USAGE_POLICIES, custom)
}

function deepMergePolicies(base, patch) {
  const out = { ...base, ...patch }
  if (patch.roleLimits) {
    out.roleLimits = { ...base.roleLimits }
    for (const role of Object.keys(base.roleLimits)) {
      out.roleLimits[role] = { ...base.roleLimits[role], ...(patch.roleLimits[role] || {}) }
    }
  }
  return out
}

export function roleLimitsFor(user, policies = DEFAULT_USAGE_POLICIES) {
  const role = resolveProtectionRole(user)
  return policies.roleLimits[role] || policies.roleLimits.rep
}

/** @returns {'allow'|'guide_marketing'|'block_large'} */
export function evaluatePipelineEmail(count, user, policies = DEFAULT_USAGE_POLICIES) {
  const n = Math.max(0, Number(count) || 0)
  const p = policies.pipelineEmail || DEFAULT_USAGE_POLICIES.pipelineEmail
  const roleMax = roleLimitsFor(user, policies).emailMax
  const allowCap = Math.min(p.allowMax ?? 10, roleMax)

  if (n <= allowCap) return 'allow'
  if (n > (p.blockAbove ?? 50)) return 'block_large'
  if (n > roleMax) return 'guide_marketing'
  if (n > (p.allowMax ?? 10) && n <= (p.guideMax ?? 50)) return 'guide_marketing'
  return 'block_large'
}

/** @returns {'allow'|'confirm'|'manager_required'} */
export function evaluateBulkAssign(count, user, policies = DEFAULT_USAGE_POLICIES) {
  const n = Math.max(0, Number(count) || 0)
  const role = resolveProtectionRole(user)
  const roleMax = roleLimitsFor(user, policies).bulkAssignMax
  const p = policies.bulkAssign || DEFAULT_USAGE_POLICIES.bulkAssign

  if (n > roleMax) {
    if (role === 'admin' || role === 'manager') return 'confirm'
    return 'manager_required'
  }
  if (n > (p.managerRequiredAbove ?? 500)) {
    if (role === 'admin' || role === 'manager') return 'confirm'
    return 'manager_required'
  }
  if (n > (p.confirmAbove ?? 100)) return 'confirm'
  return 'allow'
}

/** @returns {'allow'|'review'} */
export function evaluateBulkEdit(count, policies = DEFAULT_USAGE_POLICIES) {
  const n = Math.max(0, Number(count) || 0)
  const threshold = policies.bulkEdit?.reviewAbove ?? 100
  return n > threshold ? 'review' : 'allow'
}

/** @returns {'instant'|'prepare'|'background'} */
export function evaluateExport(count, user, policies = DEFAULT_USAGE_POLICIES) {
  const n = Math.max(0, Number(count) || 0)
  const roleMax = roleLimitsFor(user, policies).exportMax
  const p = policies.export || DEFAULT_USAGE_POLICIES.export
  const cap = Math.min(roleMax, p.prepareMax ?? 5000)

  if (n > cap) return 'background'
  if (n > (p.instantMax ?? 500)) return 'prepare'
  return 'instant'
}

export function findLostLeadIds(leads = []) {
  const ids = []
  for (const lead of leads) {
    const status = String(lead?.crm?.status || lead?.status || '').toLowerCase()
    if (LOST_LEAD_STATUSES.has(status)) ids.push(lead.id)
  }
  return ids
}
