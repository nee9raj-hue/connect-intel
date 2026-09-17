import { mergeLeadErp, normalizeCompanyMatchKey } from '../leadErp.js'
import { lastOrderCreatedAtFromErp, stampLastOrderCreatedAt } from '../leadLastOrder.js'
import { applyErpAccountStage } from '../erpAccountStage.js'
import { xindusIdFromLeadEntry } from '../xindusCustomerErp.js'
import {
  buildOwnerMemberIndex,
  canonicalErpOwner,
  matchErpOwnerUserId,
} from '../erpOwner.js'
import { supabaseRest } from './supabaseClient.js'
import { upsertPipelineLeadRows } from './pipelineLeadsTable.js'
import { readStore } from './store.js'
import { resolveOrganization } from './orgCrmClean.js'
import { ensureErpOwnerMemberships } from './erpOwnerMembers.js'
import { loadMemberProfilesMap } from './orgHierarchy.js'

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
  const ownership = overlay?.ownership || {}
  const packedOwners = {}
  for (const key of ['salesOwner', 'accountOwner', 'leadOwner']) {
    if (ownership[key]) packedOwners[key] = ownership[key]
  }
  return {
    revenue: prune(overlay?.revenue),
    finance: prune(overlay?.finance),
    ownership: packedOwners,
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
  if (offset === 0 && !dryRun) {
    try {
      const { applyPipelineCollaboratorIdsBootstrap } = await import('./supabaseSqlApply.js')
      await applyPipelineCollaboratorIdsBootstrap()
    } catch (err) {
      console.warn('pipeline owner trigger bootstrap:', err?.message || err)
    }
    await ensureErpOwnerMemberships(organizationId, overlays)
  }
  const metaStore = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  const ownerIndex = buildOwnerMemberIndex(metaStore, organizationId)
  const profileMap = await loadMemberProfilesMap(organizationId).catch(() => ({}))

  const index = indexOverlays(overlays)
  const tableRows = await loadPipelineLeadPage(organizationId, offset, limit)
  const pendingByShard = new Map()
  let matched = 0
  let assigned = 0
  let unassigned = 0

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
    applyErpAccountStage(entry)

    const person = canonicalErpOwner(nextErp)
    const ownerUserId = matchErpOwnerUserId(person, ownerIndex)
    entry.assignedToUserId = ownerUserId || null
    if (ownerUserId) {
      assigned += 1
      const teamId = profileMap[ownerUserId]?.teamId
      if (teamId) {
        entry.teamId = String(teamId)
        if (profileMap[ownerUserId]?.departmentId) {
          entry.departmentId = String(profileMap[ownerUserId].departmentId)
        }
      }
    } else {
      unassigned += 1
      entry.teamId = null
      entry.departmentId = null
    }

    const list = pendingByShard.get(row.shard_name) || []
    list.push(entry)
    pendingByShard.set(row.shard_name, list)
  }

  let updated = 0
  if (!dryRun) {
    const allEntries = []
    for (const [shardName, entries] of pendingByShard) {
      await upsertPipelineLeadRows(shardName, entries, {
        force: true,
        skipMembershipGuard: true,
        skipEnterpriseSync: true,
        batchSize: 50,
      })
      allEntries.push(...entries)
      updated += entries.length
    }
    if (allEntries.length) {
      const { syncEnterpriseLeadsFromEntries } = await import('./enterpriseLeadsTable.js')
      await syncEnterpriseLeadsFromEntries(allEntries, { batchSize: 25 })
    }
  }

  return {
    scanned: tableRows.length,
    matched,
    updated: dryRun ? 0 : updated,
    assigned,
    unassigned,
    nextOffset: offset + tableRows.length,
    done: tableRows.length < limit,
  }
}
