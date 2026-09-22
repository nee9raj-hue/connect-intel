/**
 * Pipeline search bar vs applied query — never treat an in-flight or mid-edit
 * query as “no leads in CRM”.
 */
export function isPipelineSearchBusy({
  search = '',
  appliedSearch = '',
  filterApplying = false,
  minChars = 2,
} = {}) {
  if (filterApplying) return true
  const draft = String(search || '').trim()
  const applied = String(appliedSearch || '').trim()
  if (draft === applied) return false
  if (draft.length > 0 && draft.length < minChars) return true
  return true
}

export function shouldShowPipelineNoMatches({
  pipelineHasLeads = false,
  filteredCount = 0,
  searchBusy = false,
  marketingSliceLoading = false,
} = {}) {
  return Boolean(pipelineHasLeads) && filteredCount === 0 && !searchBusy && !marketingSliceLoading
}
