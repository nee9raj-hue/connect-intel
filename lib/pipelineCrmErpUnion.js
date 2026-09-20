import { crmLeadStatusPostgrestIn, crmStatusMatchesFilter, crmStatusSqlAliases, isCrmLeadStatusFilter, normalizeCrmLeadStatus } from './crmLeadStatuses.js'
import {
  collectCrmStageFilterIds,
  ERP_PIPELINE_FILTER_ALIASES,
  normalizePipelineTrack,
  pipelineTrackSqlAliases,
} from './crmPipelineFlow.js'
import { leadMatchesErpTagFilter } from './erpTags.js'
import { lastShipmentFilterActive, leadMatchesLastShipmentPeriod } from './leadLastShipmentFilter.js'

function erpTagNamesFrom(filters = {}) {
  return [
    ...new Set(
      [...(filters.erpTagNames || []), ...(filters.erpTags || [])]
        .map((name) => String(name || '').trim())
        .filter(Boolean)
    ),
  ]
}

export function isErpStatusFilter(status) {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
  return Boolean(raw && ERP_PIPELINE_FILTER_ALIASES[raw])
}

export function erpExclusiveFiltersActive(filters = {}) {
  return Boolean(
    erpTagNamesFrom(filters).length ||
      lastShipmentFilterActive(filters) ||
      normalizePipelineTrack(filters.pipelineTrack) === 'erp' ||
      isErpStatusFilter(filters.status)
  )
}

export function leadMatchesCrmStageIds(leadOrEntry, stageIds = []) {
  if (!stageIds.length) return true
  const status = leadOrEntry?.crm?.status ?? leadOrEntry?.lead?.crm?.status ?? leadOrEntry?.status
  return stageIds.some((id) => crmStatusMatchesFilter(status, id))
}

export function leadMatchesErpExclusiveFilters(leadOrEntry, filters = {}) {
  const status = String(filters.status || 'all').trim()
  if (status && status !== 'all' && isCrmLeadStatusFilter(status)) {
    if (!crmStatusMatchesFilter(leadOrEntry?.crm?.status, status)) return false
  } else {
    const trackIds = pipelineTrackSqlAliases(filters.pipelineTrack)
    if (trackIds.length) {
      const raw = String(leadOrEntry?.crm?.status || '')
        .trim()
        .toLowerCase()
      const allowed = new Set(trackIds)
      if (!allowed.has(raw) && !allowed.has(normalizeCrmLeadStatus(raw))) return false
    }
  }

  const erpTagNames = erpTagNamesFrom(filters)
  if (erpTagNames.length && !leadMatchesErpTagFilter(leadOrEntry, erpTagNames, filters.erpTagMode)) {
    return false
  }

  if (lastShipmentFilterActive(filters) && !leadMatchesLastShipmentPeriod(leadOrEntry, filters)) {
    return false
  }

  return true
}

/** CRM stages union with ERP-only filters: selected CRM leads stay in the view. */
export function leadMatchesCrmErpUnion(leadOrEntry, filters = {}) {
  const crmStageIds = collectCrmStageFilterIds(filters)
  if (!crmStageIds.length) return leadMatchesErpExclusiveFilters(leadOrEntry, filters)
  if (leadMatchesCrmStageIds(leadOrEntry, crmStageIds)) return true
  if (!erpExclusiveFiltersActive(filters)) return false
  return leadMatchesErpExclusiveFilters(leadOrEntry, filters)
}

export function crmStageSqlAliases(stageIds = []) {
  return [...new Set(stageIds.flatMap((id) => crmStatusSqlAliases(id)).filter(Boolean))]
}

export function crmStageSqlClause(filters = {}) {
  const aliases = crmStageSqlAliases(collectCrmStageFilterIds(filters))
  if (!aliases.length) return ''
  const inn = aliases.join(',')
  return `or=(lead_status.in.(${inn}),entry->crm->>status.in.(${inn}))`
}

function toNestedPredicate(part) {
  const raw = String(part || '').trim()
  if (!raw) return ''
  if (raw.startsWith('or=(') || raw.startsWith('and=(')) return raw
  const eq = raw.indexOf('=')
  if (eq < 0) return raw
  return `${raw.slice(0, eq)}.${raw.slice(eq + 1)}`
}

export function unionErpSqlWithCrmStages(erpParts = [], filters = {}) {
  const crmClause = crmStageSqlClause(filters)
  if (!crmClause) return [...erpParts]
  if (!erpParts.length) return [crmClause]
  if (!erpExclusiveFiltersActive(filters)) return [crmClause]
  const nestedErp = erpParts.map(toNestedPredicate).filter(Boolean)
  const erpGroup = nestedErp.length === 1 ? nestedErp[0] : `and(${nestedErp.join(',')})`
  return [`or=(${erpGroup},${toNestedPredicate(crmClause)})`]
}

export function mergeErpExclusiveSqlParts(filters = {}, extraParts = []) {
  const parts = []
  if (erpExclusiveFiltersActive(filters) && collectCrmStageFilterIds(filters).length) {
    const status = String(filters.status || 'all').trim()
    if (status && status !== 'all' && isCrmLeadStatusFilter(status)) {
      const inn = crmLeadStatusPostgrestIn(status)
      if (inn) parts.push(`entry->crm->>status=${inn}`)
    } else {
      const trackIds = pipelineTrackSqlAliases(filters.pipelineTrack)
      if (trackIds.length) parts.push(`entry->crm->>status=in.(${trackIds.join(',')})`)
    }
  }
  parts.push(...(extraParts || []))
  return unionErpSqlWithCrmStages(parts, filters)
}
