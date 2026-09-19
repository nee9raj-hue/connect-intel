/** Account / lead pipeline stages — not freight deal stages (RFQ, Quoted, Booked, …). */

export const CRM_LEAD_STATUS_DEFS = [
  {
    id: 'unqualified',
    label: 'Unqualified Lead',
    color: 'slate',
    hint: 'Raw contact, trade lanes/volumes unknown.',
  },
  {
    id: 'qualified',
    label: 'Qualified Prospect',
    color: 'blue',
    hint: 'Confirmed cross-border volume and target lanes.',
  },
  {
    id: 'opportunity',
    label: 'Sales Opportunity',
    color: 'amber',
    hint: 'Actively requesting quotes or negotiating terms.',
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    color: 'violet',
    hint: 'Contract signed; completing credit checks, KYC, and POA paperwork.',
  },
  {
    id: 'new_account',
    label: 'New Account',
    color: 'emerald',
    hint: 'First ERP shipment; stays here at least 60 days, then moves by later trading.',
  },
  {
    id: 'active_trading',
    label: 'Active Trader',
    color: 'teal',
    hint: 'ERP last shipment in the last 60 days.',
  },
  {
    id: 'at_risk',
    label: 'At Risk / Declining',
    color: 'orange',
    hint: 'Shipment volume dropped by more than 30% over 60 days.',
  },
  {
    id: 'churned',
    label: 'Churned',
    color: 'stone',
    hint: 'No ERP shipments in 60+ days.',
  },
  {
    id: 'lost',
    label: 'Lost',
    color: 'gray',
    hint: 'Disqualified or chose another forwarder/carrier.',
  },
]

export const CRM_STATUS_IDS = CRM_LEAD_STATUS_DEFS.map((row) => row.id)

/** Freight CRM-only statuses stored on crm.status (not default mixed board columns). */
export const EXTRA_CRM_STATUS_IDS = ['fresh', 'account_created_erp']

export const CRM_PIPELINE_FILTER_ALIASES = {
  fresh: ['fresh'],
  qualified: ['qualified', 'contacted'],
  unqualified: ['unqualified'],
  account_created_erp: ['account_created_erp'],
}

export const ERP_PIPELINE_FILTER_ALIASES = {
  erp_early: ['erp_early', 'early', 'new_account', 'onboarding'],
  erp_active: ['erp_active', 'active', 'active_trading', 'opportunity'],
  erp_churn: ['erp_churn', 'churn', 'churned', 'lost'],
  erp_dormant: ['erp_dormant', 'dormant', 'at_risk'],
}

export const DEFAULT_CRM_LEAD_STATUS = 'unqualified'

/** Old pipeline ids → current account stages (no data rewrite required on read). */
export const LEGACY_CRM_STATUS_MAP = {
  new: 'unqualified',
  contacted: 'qualified',
  follow_up: 'opportunity',
  replied: 'opportunity',
  won: 'onboarding',
}

const MS_DAY = 86_400_000

export function normalizeCrmLeadStatus(status) {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
  if (!raw) return DEFAULT_CRM_LEAD_STATUS
  if (CRM_STATUS_IDS.includes(raw) || EXTRA_CRM_STATUS_IDS.includes(raw)) return raw
  return LEGACY_CRM_STATUS_MAP[raw] || DEFAULT_CRM_LEAD_STATUS
}

export function crmLeadStatusMeta(status) {
  const id = normalizeCrmLeadStatus(status)
  return CRM_LEAD_STATUS_DEFS.find((row) => row.id === id) || CRM_LEAD_STATUS_DEFS[0]
}

export function crmLeadStatusLabel(status) {
  return crmLeadStatusMeta(status).label
}

/** Ids to match in SQL/JSON for a sidebar/filter status, including legacy rows. */
export function isCrmLeadStatusFilter(status) {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
  if (!raw || raw === 'all') return false
  return (
    CRM_STATUS_IDS.includes(raw) ||
    EXTRA_CRM_STATUS_IDS.includes(raw) ||
    Boolean(LEGACY_CRM_STATUS_MAP[raw]) ||
    Boolean(CRM_PIPELINE_FILTER_ALIASES[raw]) ||
    Boolean(ERP_PIPELINE_FILTER_ALIASES[raw])
  )
}

/** Ids to match in SQL/JSON for a sidebar/filter status, including legacy rows. */
export function crmStatusSqlAliases(status) {
  const wanted = String(status || '')
    .trim()
    .toLowerCase()
  if (!wanted || wanted === 'all' || !isCrmLeadStatusFilter(wanted)) return []
  if (ERP_PIPELINE_FILTER_ALIASES[wanted]) {
    return [...new Set(ERP_PIPELINE_FILTER_ALIASES[wanted])]
  }
  if (EXTRA_CRM_STATUS_IDS.includes(wanted) && CRM_PIPELINE_FILTER_ALIASES[wanted]) {
    return [...new Set(CRM_PIPELINE_FILTER_ALIASES[wanted])]
  }
  const canonical = normalizeCrmLeadStatus(wanted)
  const aliases = Object.entries(LEGACY_CRM_STATUS_MAP)
    .filter(([, mapped]) => mapped === canonical)
    .map(([legacy]) => legacy)
  return [...new Set([canonical, wanted, ...aliases])].filter(Boolean)
}

export function crmLeadStatusPostgrestIn(status) {
  const aliases = crmStatusSqlAliases(status)
  if (!aliases.length) return null
  return `in.(${aliases.join(',')})`
}

/** Map account stage onto leftover standard deal-stage ids (RFQ pipeline is separate). */
export function leadStatusToStandardDealStage(status) {
  const id = normalizeCrmLeadStatus(status)
  if (id === 'qualified') return 'contacted'
  if (id === 'opportunity' || id === 'at_risk') return 'follow_up'
  if (id === 'onboarding' || id === 'new_account' || id === 'active_trading') return 'won'
  if (id === 'lost' || id === 'churned') return 'lost'
  return 'new'
}

export function crmStatusMatchesFilter(leadStatus, filterStatus) {
  if (!filterStatus || filterStatus === 'all') return true
  const aliases = crmStatusSqlAliases(filterStatus)
  if (aliases.length) {
    const raw = String(leadStatus || '')
      .trim()
      .toLowerCase()
    const canonical = normalizeCrmLeadStatus(leadStatus)
    return aliases.includes(raw) || aliases.includes(canonical)
  }
  return normalizeCrmLeadStatus(leadStatus) === normalizeCrmLeadStatus(filterStatus)
}

export function isClosedCrmLeadStatus(status) {
  const id = normalizeCrmLeadStatus(status)
  return id === 'lost' || id === 'churned'
}

export function foldCrmStatusCounts(rows = []) {
  const folded = Object.fromEntries(CRM_STATUS_IDS.map((id) => [id, 0]))
  for (const row of rows || []) {
    const id = normalizeCrmLeadStatus(row?.status)
    folded[id] = (folded[id] || 0) + (Number(row?.count ?? row?.cnt) || 0)
  }
  return CRM_STATUS_IDS.map((status) => ({ status, count: folded[status] || 0 }))
}

export function defaultPipelineStages() {
  return CRM_LEAD_STATUS_DEFS.map((row) => ({
    id: row.id,
    label: row.label,
    color: row.color,
    hint: row.hint,
  }))
}

function looksLikeLegacyDefaultStages(stages) {
  const ids = new Set((stages || []).map((s) => s.id))
  return ids.has('follow_up') || ids.has('replied') || (ids.has('won') && ids.has('new') && ids.has('contacted'))
}

export function migrateOrgPipelineStages(stages) {
  if (!Array.isArray(stages) || !stages.length || looksLikeLegacyDefaultStages(stages)) {
    return defaultPipelineStages()
  }
  const mapped = stages.map((s) => {
    const raw = String(s.id || '').trim()
    const known = CRM_STATUS_IDS.includes(raw) || Boolean(LEGACY_CRM_STATUS_MAP[raw])
    if (!known) {
      return {
        id: raw || DEFAULT_CRM_LEAD_STATUS,
        label: s.label || raw || 'Stage',
        color: s.color || 'slate',
        hint: s.hint || '',
      }
    }
    const id = normalizeCrmLeadStatus(raw)
    const meta = crmLeadStatusMeta(id)
    const legacyLabels = ['New', 'Contacted', 'Follow up', 'Replied', 'Won', 'Active trading']
    return {
      id,
      label: s.label && !legacyLabels.includes(s.label) ? s.label : meta.label,
      color: s.color || meta.color,
      hint: meta.hint,
    }
  })
  return ensureNewAccountStage(mapped)
}

function ensureNewAccountStage(stages) {
  if ((stages || []).some((s) => s.id === 'new_account')) return stages
  const meta = crmLeadStatusMeta('new_account')
  const row = { id: meta.id, label: meta.label, color: meta.color, hint: meta.hint }
  const afterOnboarding = stages.findIndex((s) => s.id === 'onboarding')
  if (afterOnboarding >= 0) {
    return [...stages.slice(0, afterOnboarding + 1), row, ...stages.slice(afterOnboarding + 1)]
  }
  const beforeActive = stages.findIndex((s) => s.id === 'active_trading')
  if (beforeActive >= 0) {
    return [...stages.slice(0, beforeActive), row, ...stages.slice(beforeActive)]
  }
  return [...stages, row]
}

/** From shipment history: Churned (90d idle), At Risk (>30% drop over 60d), or Active Trader. */
export function suggestCrmStatusFromTradingProfile(profile, currentStatus, now = Date.now()) {
  const canonical = normalizeCrmLeadStatus(currentStatus)
  if (canonical === 'lost') return null
  if (!profile || typeof profile !== 'object') return null

  const last = profile.lastShipmentAt ? new Date(profile.lastShipmentAt).getTime() : 0
  if (last && Number.isFinite(last) && now - last >= 90 * MS_DAY) return 'churned'

  const times = (Array.isArray(profile.shipments) ? profile.shipments : [])
    .map((row) => new Date(row?.date || row).getTime())
    .filter((t) => Number.isFinite(t))
  if (last && Number.isFinite(last)) times.push(last)

  const recent = times.filter((t) => t >= now - 60 * MS_DAY).length
  const previous = times.filter((t) => t >= now - 120 * MS_DAY && t < now - 60 * MS_DAY).length
  if (previous >= 2 && recent < previous * 0.7) {
    if (['active_trading', 'at_risk', 'onboarding', 'new_account', 'churned'].includes(canonical)) return 'at_risk'
  }

  const count = Number(profile.shipmentCount) || times.length
  if (count >= 1 && last && now - last < 90 * MS_DAY) {
    if (['onboarding', 'new_account', 'at_risk', 'churned', 'active_trading'].includes(canonical)) return 'active_trading'
  }

  return null
}
