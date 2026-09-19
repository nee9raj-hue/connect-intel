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
    const name = String(item.name ?? item.label ?? '').trim()
    if (!name) continue
    const color = normalizeHex(item.color) || '#64748b'
    const type = normalizeType(item.type)
    out.push({ name, color, ...(type ? { type } : {}) })
  }
  return out
}

/** Prefer crm_payload.erp_tags, then erp.erpTags on the lead entry. */
export function readErpTagsFromLead(entry) {
  if (!entry || typeof entry !== 'object') return []

  if (Array.isArray(entry.crm_payload?.erp_tags)) {
    return normalizeErpTags(entry.crm_payload.erp_tags)
  }

  if (Array.isArray(entry.crm?.erp_tags)) {
    return normalizeErpTags(entry.crm.erp_tags)
  }

  const erpTags = entry.erp?.erpTags ?? entry.erp?.erp_tags ?? entry.lead?.erp?.erpTags ?? entry.lead?.erp?.erp_tags
  if (Array.isArray(erpTags)) return normalizeErpTags(erpTags)

  return []
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
