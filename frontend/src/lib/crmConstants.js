import {
  FREIGHT_DEAL_STAGES,
  getFreightDealStageMeta,
  isFreightDealOrg,
  isFreightDealStageClosed,
} from '../../../lib/freightDeal.js'
import { CRM_LEAD_STATUS_DEFS, DEFAULT_CRM_LEAD_STATUS, normalizeCrmLeadStatus, crmLeadStatusLabel } from '../../../lib/crmLeadStatuses.js'
import { formatDate } from './dateLocale.js'
import {
  FREIGHT_CRM_PIPELINE_STAGE_DEFS,
  FREIGHT_ERP_PIPELINE_STAGE_DEFS,
  freightBoardColumnIds,
  freightPipelineStatusLabel,
  normalizePipelineTrack,
} from '../../../lib/crmPipelineFlow.js'

export { normalizePipelineTrack }

const STAGE_TW = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  teal: 'bg-teal-50 text-teal-800 border-teal-200',
  orange: 'bg-orange-50 text-orange-800 border-orange-200',
  stone: 'bg-stone-100 text-stone-700 border-stone-200',
  gray: 'bg-gray-100 text-gray-500 border-gray-200',
}

export const CRM_STATUSES = CRM_LEAD_STATUS_DEFS.map((row) => ({
  id: row.id,
  label: row.label,
  hint: row.hint,
  color: STAGE_TW[row.color] || STAGE_TW.slate,
}))

export const CRM_STATUS_IDS = CRM_STATUSES.map((row) => row.id)

export { crmLeadStatusLabel, DEFAULT_CRM_LEAD_STATUS, normalizeCrmLeadStatus }

/** HubSpot-style deal stages for standard (non-freight) orgs — not account pipeline. */
export const DEAL_STAGES = [
  { id: 'new', label: 'New', color: STAGE_TW.slate },
  { id: 'contacted', label: 'Contacted', color: STAGE_TW.blue },
  { id: 'follow_up', label: 'Follow up', color: STAGE_TW.amber },
  { id: 'replied', label: 'Replied', color: STAGE_TW.violet },
  { id: 'won', label: 'Won', color: 'bg-[#fff4ee] text-[#FF773D] border-[#ffd4b8]' },
  { id: 'lost', label: 'Lost', color: STAGE_TW.gray },
]

export { FREIGHT_DEAL_STAGES, getFreightDealStageMeta }

/** @deprecated use FREIGHT_DEAL_STAGES[0] */
export const RFQ_DEAL_STAGE = FREIGHT_DEAL_STAGES[0]

/** Deal stage dropdown — freight uses shipment pipeline; others use CRM deal stages. */
export function getDealStagesForFreight(isFreightOrg) {
  if (!isFreightOrg) {
    return DEAL_STAGES.filter((s) => !isClosedDealStage(s.id))
  }
  return FREIGHT_DEAL_STAGES.filter((s) => !isFreightDealStageClosed(s.id))
}

export function isClosedDealStage(stage) {
  return stage === 'won' || stage === 'lost' || isFreightDealStageClosed(stage)
}

export function getDealStageMeta(stage, { freightOrg = false } = {}) {
  if (freightOrg) return getFreightDealStageMeta(stage)
  return DEAL_STAGES.find((s) => s.id === stage) || DEAL_STAGES[0]
}

export const TEAM_PIPELINE_ROLES = [
  { id: 'member', label: 'Team member', description: 'Full pipeline: all lead stages' },
  { id: 'manager', label: 'Manager', description: 'Full pipeline with team visibility' },
]

/** SQL hierarchy roles (profiles.role) — drives pipeline data scoping. */
export const HIERARCHY_SQL_ROLES = [
  { id: 'rep', label: 'Rep', description: 'Own leads only' },
  { id: 'manager', label: 'Manager', description: 'Team pipeline' },
  { id: 'admin', label: 'Admin', description: 'Full organization' },
]

export const FREIGHT_CRM_PIPELINE_COLUMNS = FREIGHT_CRM_PIPELINE_STAGE_DEFS.map((row) => ({
  id: row.id,
  label: row.label,
  hint: row.hint,
  color: STAGE_TW[row.color] || STAGE_TW.slate,
}))

export const FREIGHT_ERP_PIPELINE_COLUMNS = FREIGHT_ERP_PIPELINE_STAGE_DEFS.map((row) => ({
  id: row.id,
  label: row.label,
  hint: row.hint,
  color: STAGE_TW[row.color] || STAGE_TW.slate,
}))

export function getFreightBoardColumns({ pipelineTrack, status } = {}) {
  const ids = freightBoardColumnIds({ pipelineTrack, status })
  const catalog = [...FREIGHT_CRM_PIPELINE_COLUMNS, ...FREIGHT_ERP_PIPELINE_COLUMNS]
  return ids.map((id) => catalog.find((col) => col.id === id)).filter(Boolean)
}

export function getVisiblePipelineColumns(user, { pipelineTrack, status } = {}) {
  const freight = isFreightDealOrg(user)
  const track = normalizePipelineTrack(pipelineTrack)
  if (freight && track === 'erp') return FREIGHT_ERP_PIPELINE_COLUMNS
  if (freight && track === 'crm') return FREIGHT_CRM_PIPELINE_COLUMNS
  if (freight && String(status || '').startsWith('erp_')) return FREIGHT_ERP_PIPELINE_COLUMNS
  if (
    freight &&
    ['fresh', 'account_created_erp'].includes(String(status || ''))
  ) {
    return FREIGHT_CRM_PIPELINE_COLUMNS
  }
  if (!user || user.accountType !== 'company') return CRM_STATUSES
  return CRM_STATUSES
}

export const EMAIL_PURPOSES = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'follow_up', label: 'Follow up' },
  { id: 'meeting', label: 'Meeting request' },
]

export function defaultCrm() {
  return {
    status: DEFAULT_CRM_LEAD_STATUS,
    notes: '',
    lastEmailSentAt: null,
    lastResponseAt: null,
    responseReceived: false,
    emails: [],
    activities: [],
    tasks: [],
    meetings: [],
    nextFollowUpAt: null,
    lastCommunicationAt: null,
    lastCommunicationType: null,
    lastCommunicationSummary: '',
  }
}

export function getStatusMeta(statusId, { freightOrg = false, pipelineTrack } = {}) {
  const raw = String(statusId || '').trim().toLowerCase()
  if (freightOrg) {
    const label = freightPipelineStatusLabel(raw, { pipelineTrack })
    const fromFreight =
      FREIGHT_CRM_PIPELINE_COLUMNS.find((s) => s.id === raw) ||
      FREIGHT_ERP_PIPELINE_COLUMNS.find((s) => s.id === raw) ||
      (label
        ? FREIGHT_ERP_PIPELINE_COLUMNS.find((s) => s.label === label) ||
          FREIGHT_CRM_PIPELINE_COLUMNS.find((s) => s.label === label)
        : null)
    if (fromFreight) return fromFreight
  }
  const id = normalizeCrmLeadStatus(statusId)
  return CRM_STATUSES.find((s) => s.id === id) || CRM_STATUSES[0]
}

export function formatCrmDate(iso) {
  return formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function buildMailto(lead, subject, body) {
  const email = lead.email && !lead.email.includes('•') && !lead.email.includes('locked') ? lead.email : ''
  if (!email) return null
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (body) params.set('body', body)
  const qs = params.toString()
  return `mailto:${encodeURIComponent(email)}${qs ? `?${qs}` : ''}`
}
