/** Human-readable pipeline list breadcrumb (header subline). */

export function buildPipelineBreadcrumb({
  total = 0,
  showing = 0,
  parts = [],
  hasActiveFilters = false,
  filteredTotal = null,
} = {}) {
  const segments = []
  if (total > 0) {
    segments.push(`${total.toLocaleString()} leads`)
  }
  if (showing > 0) {
    segments.push(`Showing ${showing.toLocaleString()}`)
  }
  if (hasActiveFilters && filteredTotal != null && filteredTotal !== total) {
    segments.push(`${filteredTotal.toLocaleString()} match filters`)
  }
  for (const p of parts) {
    if (p) segments.push(p)
  }
  if (!segments.length) return 'Pipeline'
  return segments.join(' · ')
}

export function pipelineFilterParts({
  statusLabel,
  assigneeName,
  cityLabels = [],
  stateLabels = [],
  tagLabels = [],
  search = '',
} = {}) {
  const parts = []
  if (statusLabel) parts.push(`Status: ${statusLabel}`)
  if (assigneeName) parts.push(`Owner: ${assigneeName}`)
  if (cityLabels.length) parts.push(`City: ${cityLabels.join(', ')}`)
  if (stateLabels.length) parts.push(`State: ${stateLabels.join(', ')}`)
  if (tagLabels.length) parts.push(`Tags: ${tagLabels.join(', ')}`)
  if (search?.trim()) parts.push(`Search: “${search.trim()}”`)
  return parts
}
