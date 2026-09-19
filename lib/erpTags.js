/** Read-only ERP tags. Never merge into CRM tagIds / pipeline state. */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function text(value) {
  const s = String(value ?? '').trim()
  return s || ''
}

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

export function normalizeErpTag(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') {
    const name = text(raw)
    return name ? { name, color: '', type: '' } : null
  }
  if (typeof raw !== 'object') return null
  const name = text(raw.name ?? raw.tagName ?? raw.label)
  if (!name) return null
  return {
    name,
    color: normalizeHex(raw.color ?? raw.hex ?? raw.colour),
    type: normalizeType(raw.type),
  }
}

export function normalizeErpTags(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  const seen = new Set()
  for (const row of raw) {
    const tag = normalizeErpTag(row)
    if (!tag) continue
    const key = tag.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}

/** Current ERP tags only — overlay re-pushes on change; do not convert to CRM tags. */
export function readErpTagsFromLead(leadOrEntry) {
  if (!leadOrEntry || typeof leadOrEntry !== 'object') return []
  const nested = leadOrEntry.lead && typeof leadOrEntry.lead === 'object' ? leadOrEntry.lead : null
  const erp = leadOrEntry.erp || nested?.erp || null
  return normalizeErpTags(
    erp?.erpTags ??
      erp?.erp_tags ??
      leadOrEntry.crm_payload?.erp_tags ??
      leadOrEntry.crm?.erp_tags ??
      nested?.crm_payload?.erp_tags ??
      []
  )
}

export function erpTagChipTextColor(hex) {
  const color = normalizeHex(hex)
  if (!color) return '#33475b'
  const n = Number.parseInt(color.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#1a1a1a' : '#ffffff'
}
