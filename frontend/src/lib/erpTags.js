/** Read-only ERP tags — display only; never mixed with CRM tagIds. */

function namedTags(raw) {
  if (!Array.isArray(raw)) return null
  return raw.filter((t) => t && t.name)
}

export function readErpTagsFromLead(lead) {
  if (!lead || typeof lead !== 'object') return []

  const fromPayload = namedTags(lead.crm_payload?.erp_tags)
  if (fromPayload) return fromPayload

  const fromCrm = namedTags(lead.crm?.erp_tags)
  if (fromCrm) return fromCrm

  const fromRoot = namedTags(lead.erpTags)
  if (fromRoot?.length) return fromRoot

  const fromErp = namedTags(lead.erp?.erpTags ?? lead.erp?.erp_tags)
  return fromErp || []
}
