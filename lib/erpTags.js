/** Read-only ERP tags — never merge into CRM tagIds / pipeline state. */

import { erpStageMatchKeys, erpStageTagFromLead, erpStageTagOptions } from './crmPipelineFlow.js'

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

export function collectErpTagOptions(leads = [], extraNames = [], { includeStages = false } = {}) {
  const byKey = new Map()
  if (includeStages) {
    for (const tag of erpStageTagOptions()) {
      byKey.set(tag.name.toLowerCase(), { ...tag })
    }
  }
  for (const lead of leads || []) {
    for (const tag of readDisplayErpTagsFromLead(lead)) {
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
  const stages = new Set(erpStageTagOptions().map((t) => t.name.toLowerCase()))
  return [...byKey.values()].sort((a, b) => {
    const aStage = stages.has(a.name.toLowerCase())
    const bStage = stages.has(b.name.toLowerCase())
    if (aStage !== bStage) return aStage ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

export function readDisplayErpTagsFromLead(entry) {
  const feed = readErpTagsFromLead(entry)
  const stage = erpStageTagFromLead(entry)
  if (!stage) return feed
  if (feed.some((tag) => tag.name.toLowerCase() === stage.name.toLowerCase())) return feed
  return [stage, ...feed]
}

export function leadMatchesErpTagFilter(leadOrEntry, names = [], mode = 'any') {
  const wanted = (names || []).map((n) => String(n || '').trim().toLowerCase()).filter(Boolean)
  if (!wanted.length) return true
  const status = String(leadOrEntry?.crm?.status || leadOrEntry?.lead?.crm?.status || '')
    .trim()
    .toLowerCase()
  const have = new Set(readDisplayErpTagsFromLead(leadOrEntry).map((t) => t.name.toLowerCase()))
  const matches = (name) => {
    const keys = erpStageMatchKeys(name)
    if (keys.some((key) => have.has(key))) return true
    if (status && keys.includes(status)) return true
    return have.has(name)
  }
  if (String(mode || 'any').toLowerCase() === 'all') return wanted.every(matches)
  return wanted.some(matches)
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
