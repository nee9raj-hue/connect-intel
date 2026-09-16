import { mergeLeadErp, normalizeCompanyMatchKey } from '../leadErp.js'
import { lastOrderCreatedAtFromErp, stampLastOrderCreatedAt } from '../leadLastOrder.js'
import { xindusIdFromLeadEntry } from '../xindusCustomerErp.js'
import { supabaseRest } from './supabaseClient.js'
import { upsertPipelineLeadRows } from './pipelineLeadsTable.js'
import { readStore } from './store.js'
import { resolveOrganization } from './orgCrmClean.js'

export function phoneKey(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length >= 10) return digits.slice(-10)
  return digits || ''
}

export function compactErp(overlay) {
  const prune = (obj) => {
    const out = {}
    for (const [key, value] of Object.entries(obj || {})) {
      if (value == null || value === '') continue
      if (Array.isArray(value) && !value.length) continue
      out[key] = value
    }
    return out
  }
  return {
    revenue: prune(overlay?.revenue),
    finance: prune(overlay?.finance),
  }
}

export function indexOverlays(overlays = []) {
  const byId = new Map()
  const byPhone = new Map()
  const byEmail = new Map()
  const byCompany = new Map()
  for (const item of overlays) {
    const erp = item.erp || item.overlay
    if (!erp) continue
    const packed = {
      overlay: erp,
      phone: phoneKey(item.phone),
      email: String(item.email || '').trim().toLowerCase(),
      xindusId: String(item.xindusId || item.id || '').replace(/\.0$/, ''),
      company: String(item.company || '').trim(),
    }
    if (packed.xindusId) byId.set(packed.xindusId, packed)
    if (packed.phone) byPhone.set(packed.phone, packed)
    if (packed.email) byEmail.set(packed.email, packed)
    const ck = normalizeCompanyMatchKey(packed.company)
    if (ck && !byCompany.has(ck)) byCompany.set(ck, packed)
  }
  return { byId, byPhone, byEmail, byCompany }
}

export function matchLeadToOverlay(entry, index) {
  const lead = entry?.lead || {}
  const xid = xindusIdFromLeadEntry(entry)
  if (xid && index.byId.has(xid)) return index.byId.get(xid)
  const email = String(lead.email || '').trim().toLowerCase()
  if (email && index.byEmail.has(email)) return index.byEmail.get(email)
  const phone = phoneKey(lead.phone)
  if (phone && index.byPhone.has(phone)) return index.byPhone.get(phone)
  const ck = normalizeCompanyMatchKey(lead.company)
  if (ck && index.byCompany.has(ck)) return index.byCompany.get(ck)
  return null
}

export async function resolveXindusOrgId(nameQuery = 'Xindus') {
  const store = await readStore({ only: ['organizations'] })
  const org = resolveOrganization(store, { nameQuery })
  return org.id
}

export async function loadPipelineLeadPage(organizationId, offset, limit) {
  const path =
    `pipeline_leads?organization_id=eq.${encodeURIComponent(organizationId)}` +
    `&select=lead_id,shard_name,entry&order=lead_id.asc&limit=${limit}&offset=${offset}`
  const rows = await supabaseRest(path, {}, { timeoutMs: 45_000 })
  return Array.isArray(rows) ? rows : []
}

export async function applyOverlaysToLeadPage({
  organizationId,
  overlays,
  offset = 0,
  limit = 250,
  dryRun = false,
}) {
  const index = indexOverlays(overlays)
  const tableRows = await loadPipelineLeadPage(organizationId, offset, limit)
  const pendingByShard = new Map()
  let matched = 0

  for (const row of tableRows) {
    const entry = row.entry
    if (!entry) continue
    const hit = matchLeadToOverlay(entry, index)
    if (!hit) continue
    matched += 1
    const nextErp = mergeLeadErp(entry.erp || entry.lead?.erp, hit.overlay)
    entry.erp = nextErp
    if (entry.lead) entry.lead.erp = nextErp
    stampLastOrderCreatedAt(entry, lastOrderCreatedAtFromErp(nextErp))
    const list = pendingByShard.get(row.shard_name) || []
    list.push(entry)
    pendingByShard.set(row.shard_name, list)
  }

  let updated = 0
  if (!dryRun) {
    for (const [shardName, entries] of pendingByShard) {
      await upsertPipelineLeadRows(shardName, entries, {
        force: true,
        skipMembershipGuard: true,
        batchSize: 50,
      })
      updated += entries.length
    }
  }

  return {
    scanned: tableRows.length,
    matched,
    updated: dryRun ? 0 : updated,
    nextOffset: offset + tableRows.length,
    done: tableRows.length < limit,
  }
}
