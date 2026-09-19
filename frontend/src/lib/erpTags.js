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

export function collectErpTagOptions(leads = [], extraNames = []) {
  const byKey = new Map()
  for (const lead of leads || []) {
    for (const tag of readErpTagsFromLead(lead)) {
      const key = tag.name.toLowerCase()
      if (!byKey.has(key)) byKey.set(key, { name: tag.name, color: tag.color, type: tag.type })
    }
  }
  for (const raw of extraNames || []) {
    const name = String(raw || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (!byKey.has(key)) byKey.set(key, { name, color: '#64748b' })
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function leadMatchesErpTagFilter(lead, names = [], mode = 'any') {
  const wanted = (names || []).map((n) => String(n || '').trim().toLowerCase()).filter(Boolean)
  if (!wanted.length) return true
  const have = new Set(readErpTagsFromLead(lead).map((t) => t.name.toLowerCase()))
  if (String(mode || 'any').toLowerCase() === 'all') return wanted.every((n) => have.has(n))
  return wanted.some((n) => have.has(n))
}
