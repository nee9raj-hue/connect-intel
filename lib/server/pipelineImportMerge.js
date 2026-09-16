import { normalizeCrmLeadStatus } from '../crmLeadStatuses.js'

/** Status only when the import row actually has one — never default-overwrite CRM. */
export function explicitImportLeadStatus(row) {
  const raw = String(
    row?.pipeline_status || row?.pipelineStatus || row?.crm_status || row?.status || ''
  ).trim()
  if (!raw) return null
  return normalizeCrmLeadStatus(raw.toLowerCase().replace(/\s+/g, '_'))
}

function hasText(value) {
  if (value == null) return false
  if (typeof value === 'string') return Boolean(value.trim())
  return true
}

/**
 * Overlay ERP/import identity onto an existing CRM lead.
 * Empty import cells do not wipe names, phones, or other CRM-filled fields.
 */
export function mergeImportedLeadOntoExisting(existingLead, importedLead) {
  const prev = existingLead && typeof existingLead === 'object' ? existingLead : {}
  const next = importedLead && typeof importedLead === 'object' ? importedLead : {}
  const merged = { ...prev }
  for (const [key, value] of Object.entries(next)) {
    if (!hasText(value)) continue
    merged[key] = value
  }
  merged.inPipeline = true
  return merged
}

/**
 * Re-import may update lifecycle/tags/notes. Deals, activities, tasks, meetings,
 * and emails stay CRM-owned (ERP customers do not carry deals).
 */
export function mergeImportedCrmOntoExisting(prevCrm, { status = null, notes = null, tagIds = null } = {}) {
  const prev = prevCrm && typeof prevCrm === 'object' ? prevCrm : {}
  const next = { ...prev }
  if (status) next.status = status
  if (notes) next.notes = notes
  if (Array.isArray(tagIds)) next.tagIds = tagIds
  next.deals = Array.isArray(prev.deals) ? prev.deals : []
  next.activities = Array.isArray(prev.activities) ? prev.activities : []
  next.tasks = Array.isArray(prev.tasks) ? prev.tasks : []
  next.meetings = Array.isArray(prev.meetings) ? prev.meetings : []
  next.emails = Array.isArray(prev.emails) ? prev.emails : []
  next.primaryDealId = prev.primaryDealId || null
  next.dealValue = prev.dealValue
  next.expectedCloseDate = prev.expectedCloseDate || null
  next.nextFollowUpAt = prev.nextFollowUpAt || null
  next.customFields =
    prev.customFields && typeof prev.customFields === 'object' ? { ...prev.customFields } : {}
  return next
}
