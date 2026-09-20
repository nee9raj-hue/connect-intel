import {
  CRM_PIPELINE_FILTER_ALIASES,
  ERP_PIPELINE_FILTER_ALIASES,
  normalizeCrmLeadStatus,
} from './crmLeadStatuses.js'

export { CRM_PIPELINE_FILTER_ALIASES, ERP_PIPELINE_FILTER_ALIASES }

/** CRM pipeline (manual). Stored on crm.status — not merged with ERP tags. */
export const FREIGHT_CRM_PIPELINE_STAGE_DEFS = [
  {
    id: 'fresh',
    label: 'Fresh Lead',
    color: 'slate',
    hint: 'Newly created CRM lead that is not in ERP yet.',
  },
  {
    id: 'qualified',
    label: 'Qualified Prospect',
    color: 'blue',
    hint: 'Confirmed cross-border volume and target lanes.',
  },
  {
    id: 'unqualified',
    label: 'Unqualified Lead',
    color: 'slate',
    hint: 'Raw contact, trade lanes/volumes unknown.',
  },
  {
    id: 'account_created_erp',
    label: 'Account Created on ERP',
    color: 'emerald',
    hint: 'CRM lead with an ERP account. Merge to move it into the ERP pipeline.',
  },
]

/** ERP pipeline (automatic). Filter ids; stored statuses stay new_account / active_trading / … */
export const FREIGHT_ERP_PIPELINE_STAGE_DEFS = [
  {
    id: 'erp_early',
    label: 'Early',
    color: 'emerald',
    hint: 'Account created in the last 30 days (0–60 transacting days in the last 30).',
  },
  {
    id: 'erp_active',
    label: 'Active',
    color: 'teal',
    hint: 'Transacting in the last 15 days; account older than 30 days.',
  },
  {
    id: 'erp_churn',
    label: 'Churn',
    color: 'stone',
    hint: 'No transactions in the last 30 days; account older than 30 days.',
  },
  {
    id: 'erp_dormant',
    label: 'Dormant',
    color: 'orange',
    hint: 'No transactions in the last 15 days; account older than 30 days.',
  },
]

const CRM_ORIGIN_STATUSES = new Set(['fresh', 'account_created_erp', 'qualified', 'unqualified', 'new', 'contacted'])

export function normalizePipelineTrack(raw) {
  const track = String(raw || '')
    .trim()
    .toLowerCase()
  return track === 'crm' || track === 'erp' ? track : ''
}

export function normalizeDealCustomerTypeFilter(raw) {
  const type = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (type === 'commercial' || type === 'spot_rfq' || type === 'rfq') return 'commercial'
  if (type === 'courier') return 'courier'
  return ''
}

export function dealMatchesCustomerType(freight, type) {
  const wanted = normalizeDealCustomerTypeFilter(type)
  if (!wanted) return true
  const current = String(freight?.customerType || 'spot_rfq')
    .trim()
    .toLowerCase()
  if (wanted === 'courier') return current === 'courier'
  return current !== 'courier'
}

export function pipelineTrackSqlAliases(track) {
  const t = normalizePipelineTrack(track)
  if (t === 'crm') {
    return [...new Set(['fresh', 'qualified', 'unqualified', 'account_created_erp', 'new', 'contacted'])]
  }
  if (t === 'erp') {
    return [...new Set(Object.values(ERP_PIPELINE_FILTER_ALIASES).flat())]
  }
  return []
}

export function isCrmOriginPipelineLead(entry) {
  if (!entry || typeof entry !== 'object') return false
  if (entry.crm?.erpPipelineOwned) return false
  const raw = String(entry.crm?.status || '')
    .trim()
    .toLowerCase()
  if (raw === 'fresh' || raw === 'account_created_erp') return true
  const source = String(entry.source || entry.importSource || entry.lead?.source || '')
  if (/erp|xindus|overlay|metabase|pulled/i.test(source)) return false
  if (!CRM_ORIGIN_STATUSES.has(raw) && !CRM_ORIGIN_STATUSES.has(normalizeCrmLeadStatus(raw))) {
    return false
  }
  const current = normalizeCrmLeadStatus(raw)
  return current === 'qualified' || current === 'unqualified' || raw === 'fresh' || raw === 'account_created_erp'
}

export function isErpDuplicatePending(leadOrEntry) {
  if (!leadOrEntry || typeof leadOrEntry !== 'object') return false
  return Boolean(
    leadOrEntry.crm?.erpDuplicatePending ||
      leadOrEntry.crm_payload?.erpDuplicatePending ||
      leadOrEntry.lead?.crm?.erpDuplicatePending
  )
}

export function stampErpDuplicatePending(entry) {
  if (!entry || typeof entry !== 'object') return entry
  const crm = entry.crm && typeof entry.crm === 'object' ? { ...entry.crm } : {}
  if (crm.erpDuplicatePending) return entry
  crm.erpDuplicatePending = true
  entry.crm = crm
  return entry
}

export function mapStoredStatusToErpFilter(status) {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
  if (!raw) return ''
  for (const [filterId, aliases] of Object.entries(ERP_PIPELINE_FILTER_ALIASES)) {
    if (aliases.includes(raw)) return filterId
  }
  return ''
}

const ERP_STAGE_TAG_HEX = {
  emerald: '#059669',
  teal: '#0d9488',
  stone: '#78716c',
  orange: '#ea580c',
}

export function resolveErpStageDef(nameOrId) {
  const raw = String(nameOrId || '')
    .trim()
    .toLowerCase()
  if (!raw) return null
  return (
    FREIGHT_ERP_PIPELINE_STAGE_DEFS.find((s) => s.id === raw || s.label.toLowerCase() === raw) ||
    FREIGHT_ERP_PIPELINE_STAGE_DEFS.find((s) => (ERP_PIPELINE_FILTER_ALIASES[s.id] || []).includes(raw)) ||
    null
  )
}

/** Read-only chip for the ERP pipeline stage — not written into CRM tagIds. */
export function erpStageTagFromLead(entry) {
  if (!entry || typeof entry !== 'object') return null
  const status = entry.crm?.status ?? entry.lead?.crm?.status ?? entry.status
  const filterId = mapStoredStatusToErpFilter(status)
  const def = resolveErpStageDef(filterId || status)
  if (!def) return null
  return {
    name: def.label,
    color: ERP_STAGE_TAG_HEX[def.color] || '#64748b',
    type: 'automatic',
    source: 'stage',
  }
}

export function erpStageStatusAliases(nameOrId) {
  const def = resolveErpStageDef(nameOrId)
  if (!def) return []
  return [...new Set(ERP_PIPELINE_FILTER_ALIASES[def.id] || [])]
}

export function erpStageMatchKeys(nameOrId) {
  const raw = String(nameOrId || '')
    .trim()
    .toLowerCase()
  const def = resolveErpStageDef(raw)
  if (!def) return raw ? [raw] : []
  return [...new Set([def.label.toLowerCase(), def.id, ...(ERP_PIPELINE_FILTER_ALIASES[def.id] || [])])]
}

export function erpStageTagOptions() {
  return FREIGHT_ERP_PIPELINE_STAGE_DEFS.map((def) => ({
    name: def.label,
    color: ERP_STAGE_TAG_HEX[def.color] || '#64748b',
    type: 'automatic',
    source: 'stage',
  }))
}

export function freightPipelineStatusLabel(status, { pipelineTrack } = {}) {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
  const track = normalizePipelineTrack(pipelineTrack)
  if (track === 'erp' || mapStoredStatusToErpFilter(raw)) {
    const filterId = FREIGHT_ERP_PIPELINE_STAGE_DEFS.some((s) => s.id === raw)
      ? raw
      : mapStoredStatusToErpFilter(raw)
    const meta = FREIGHT_ERP_PIPELINE_STAGE_DEFS.find((s) => s.id === filterId)
    if (meta) return meta.label
  }
  const crmMeta = FREIGHT_CRM_PIPELINE_STAGE_DEFS.find((s) => s.id === raw)
  if (crmMeta) return crmMeta.label
  return ''
}
