/** Read-only ERP tags — display only; never mixed with CRM tagIds. */

function namedTags(raw) {
  if (!Array.isArray(raw)) return null
  const tags = raw
    .map((t) => {
      if (!t || typeof t !== 'object') return null
      const name = String(t.name ?? t.label ?? t.tagName ?? '').trim()
      if (!name) return null
      return { ...t, name }
    })
    .filter(Boolean)
  return tags
}

function firstNamed(...candidates) {
  for (const raw of candidates) {
    const tags = namedTags(raw)
    if (tags?.length) return tags
  }
  return []
}

export function readErpTagsFromLead(lead) {
  if (!lead || typeof lead !== 'object') return []

  if (Array.isArray(lead.crm_payload?.erp_tags)) {
    const fromPayload = namedTags(lead.crm_payload.erp_tags)
    if (fromPayload?.length) return fromPayload
    const fromRevenue = firstNamed(lead.erp?.revenue?.tags, lead.lead?.erp?.revenue?.tags)
    if (fromRevenue.length) return fromRevenue
    return []
  }

  const fromCrm = namedTags(lead.crm?.erp_tags)
  if (fromCrm?.length) return fromCrm

  return firstNamed(
    lead.erpTags,
    lead.erp?.erpTags,
    lead.erp?.erp_tags,
    lead.lead?.erp?.erpTags,
    lead.lead?.erp?.erp_tags,
    lead.erp?.revenue?.tags,
    lead.lead?.erp?.revenue?.tags
  )
}
