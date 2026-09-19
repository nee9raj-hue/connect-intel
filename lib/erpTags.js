/** Read-only ERP tags — never merge into CRM tagIds / pipeline state. */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function normalizeHex(value) {
  const raw = String(value || '').trim()
  if (!HEX.test(raw)) return ''
  if (raw.length === 4) {
    const [, a, b, c] = raw
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase()
  }
  return raw.toLowerCase()
}

function normalizeType(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'automatic' || raw === 'auto') return 'automatic'
  if (raw === 'manual') return 'manual'
  return ''
}

/** @returns {{ name: string, color: string, type: string }[]} */
export function normalizeErpTags(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const name = String(item.name ?? item.label ?? item.tagName ?? '').trim()
    if (!name) continue
    const color = normalizeHex(item.color) || '#64748b'
    const type = normalizeType(item.type)
    out.push({ name, color, ...(type ? { type } : {}) })
  }
  return out
}

/** True when ERP sent an array (including empty — do not keep stale chips). */
export function hasExplicitErpTagArray(entry) {
  if (!entry || typeof entry !== 'object') return false
  return (
    Array.isArray(entry.crm_payload?.erp_tags) ||
    Array.isArray(entry.crm?.erp_tags) ||
    Array.isArray(entry.erp?.erpTags) ||
    Array.isArray(entry.erp?.erp_tags) ||
    Array.isArray(entry.lead?.erp?.erpTags) ||
    Array.isArray(entry.lead?.erp?.erp_tags) ||
    Array.isArray(entry.erp?.revenue?.tags) ||
    Array.isArray(entry.lead?.erp?.revenue?.tags)
  )
}

function firstNamedErpTagList(...candidates) {
  for (const raw of candidates) {
    const tags = normalizeErpTags(raw)
    if (tags.length) return tags
  }
  return []
}

/** Prefer crm_payload.erp_tags, then erp.erpTags, then erp.revenue.tags (tagName). */
export function readErpTagsFromLead(entry) {
  if (!entry || typeof entry !== 'object') return []

  if (Array.isArray(entry.crm_payload?.erp_tags)) {
    const fromPayload = normalizeErpTags(entry.crm_payload.erp_tags)
    if (fromPayload.length) return fromPayload
    const fromRevenueWhileEmpty = firstNamedErpTagList(
      entry.erp?.revenue?.tags,
      entry.lead?.erp?.revenue?.tags
    )
    if (fromRevenueWhileEmpty.length) return fromRevenueWhileEmpty
    return []
  }

  if (Array.isArray(entry.crm?.erp_tags)) {
    const fromCrm = normalizeErpTags(entry.crm.erp_tags)
    if (fromCrm.length) return fromCrm
  }

  return firstNamedErpTagList(
    entry.erpTags,
    entry.erp?.erpTags,
    entry.erp?.erp_tags,
    entry.lead?.erp?.erpTags,
    entry.lead?.erp?.erp_tags,
    entry.erp?.revenue?.tags,
    entry.lead?.erp?.revenue?.tags
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

export function leadMatchesErpTagFilter(leadOrEntry, names = [], mode = 'any') {
  const wanted = (names || []).map((n) => String(n || '').trim().toLowerCase()).filter(Boolean)
  if (!wanted.length) return true
  const have = new Set(readErpTagsFromLead(leadOrEntry).map((t) => t.name.toLowerCase()))
  if (String(mode || 'any').toLowerCase() === 'all') return wanted.every((n) => have.has(n))
  return wanted.some((n) => have.has(n))
}

/** Write erp_tags onto crm_payload (does not touch CRM tagIds). */
export function stampErpTagsOnEntry(entry, rawTags) {
  if (!entry || typeof entry !== 'object') return entry
  if (!Array.isArray(rawTags)) return entry

  const erp_tags = normalizeErpTags(rawTags)
  const previous =
    entry.crm_payload && typeof entry.crm_payload === 'object' ? { ...entry.crm_payload } : {}
  entry.crm_payload = { ...previous, erp_tags }

  if (entry.erp && typeof entry.erp === 'object') {
    entry.erp = { ...entry.erp, erpTags: erp_tags }
  }
  if (entry.lead?.erp && typeof entry.lead.erp === 'object') {
    entry.lead.erp = { ...entry.lead.erp, erpTags: erp_tags }
  }
  return entry
}
