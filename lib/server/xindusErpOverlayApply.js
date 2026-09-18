import { listPipelineActorIds } from '../pipelineActorIds.js'
import { mergeLeadErp, normalizeCompanyMatchKey, companyKeysLooselyMatch } from '../leadErp.js'
import { lastOrderCreatedAtFromErp, laterIsoTimestamp, stampLastOrderCreatedAt } from '../leadLastOrder.js'
import { applyErpAccountStage } from '../erpAccountStage.js'
import { xindusIdFromLeadEntry } from '../xindusCustomerErp.js'
import {
  buildOwnerMemberIndex,
  canonicalErpOwner,
  emptyErpOwnership,
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

export function taxIdKey(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function indexOverlays(overlays = []) {
  const byId = new Map()
  const byPhone = new Map()
  const byEmail = new Map()
  const byCompany = new Map()
  const byGst = new Map()
  const byCrn = new Map()
  const byPan = new Map()
  const byCrmId = new Map()
  for (const item of overlays) {
    const erp = item.erp || item.overlay
    if (!erp) continue
    const packed = {
      overlay: erp,
      phone: phoneKey(item.phone),
      email: String(item.email || '').trim().toLowerCase(),
      xindusId: String(item.xindusId || item.id || '').replace(/\.0$/, ''),
      crmId: String(item.crmId || item.crmID || '').replace(/\.0$/, ''),
      company: String(item.company || item.companyName || '').trim(),
      gst: taxIdKey(item.gst || item.gstn || erp.revenue?.gstn),
      crn: String(item.crn || erp.revenue?.crn || '')
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, ''),
      pan: taxIdKey(item.pan || erp.revenue?.pan),
    }
    if (packed.xindusId) byId.set(packed.xindusId, packed)
    if (packed.crmId) byCrmId.set(packed.crmId, packed)
    if (packed.phone) byPhone.set(packed.phone, packed)
    if (packed.email) byEmail.set(packed.email, packed)
    if (packed.gst) byGst.set(packed.gst, packed)
    if (packed.crn) byCrn.set(packed.crn, packed)
    if (packed.pan && packed.pan.length >= 10) byPan.set(packed.pan, packed)
    for (const raw of [packed.company, item.companyName, item.legalName]) {
      const ck = normalizeCompanyMatchKey(raw)
      if (ck && !byCompany.has(ck)) byCompany.set(ck, packed)
      const compact = ck.replace(/\s+/g, '')
      if (compact && compact !== ck && !byCompany.has(compact)) byCompany.set(compact, packed)
    }
  }
  return { byId, byPhone, byEmail, byCompany, byGst, byCrn, byPan, byCrmId }
}

function leadPhoneKeys(lead) {
  const values = [
    lead?.phone,
    lead?.mobile,
    lead?.whatsapp,
    lead?.phoneNumber,
    lead?.phone_number,
    lead?.whatsappNumber,
  ]
  if (Array.isArray(lead?.phones)) values.push(...lead.phones)
  const keys = []
  for (const value of values) {
    const raw = value && typeof value === 'object' ? value.number || value.phone : value
    const key = phoneKey(raw)
    if (key) keys.push(key)
  }
  return keys
}

function leadEmailKeys(entry) {
  const lead = entry?.lead || {}
  return [lead.email, lead.workEmail, lead.contactEmail, entry.email]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
}

function leadCrmIds(entry) {
  const lead = entry?.lead || {}
  return [lead.crmId, lead.zohoCrmId, lead.id, entry.lead_id, entry.id]
    .map((value) => String(value || '').trim().replace(/\.0$/, ''))
    .filter((value) => /^\d{5,}$/.test(value))
}

function leadCompanyKeys(entry) {
  const lead = entry?.lead || {}
  return [lead.company, lead.companyName, entry?.company]
    .map((value) => normalizeCompanyMatchKey(value))
    .filter(Boolean)
}

export function matchLeadToOverlay(entry, index) {
  const lead = entry?.lead || {}
  const xid = xindusIdFromLeadEntry(entry)
  if (xid && index.byId.has(xid)) return index.byId.get(xid)
  for (const crmId of leadCrmIds(entry)) {
    if (index.byCrmId?.has(crmId)) return index.byCrmId.get(crmId)
    if (index.byId.has(crmId)) return index.byId.get(crmId)
  }
  const leadNumericId = String(lead.id || '').replace(/\.0$/, '')
  if (/^\d{3,}$/.test(leadNumericId) && index.byId.has(leadNumericId)) return index.byId.get(leadNumericId)
  for (const email of leadEmailKeys(entry)) {
    if (index.byEmail.has(email)) return index.byEmail.get(email)
  }
  for (const phone of leadPhoneKeys(lead)) {
    if (index.byPhone.has(phone)) return index.byPhone.get(phone)
  }
  const gst = taxIdKey(lead.gst || lead.gstn || lead.gstin || lead.gstNumber || entry.gst)
  if (gst && index.byGst?.has(gst)) return index.byGst.get(gst)
  const pan = taxIdKey(lead.pan || entry.pan)
  if (pan && pan.length >= 10 && index.byPan?.has(pan)) return index.byPan.get(pan)
  const crn = String(lead.crn || entry.crn || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
  if (crn && index.byCrn?.has(crn)) return index.byCrn.get(crn)
  for (const ck of leadCompanyKeys(entry)) {
    if (index.byCompany.has(ck)) return index.byCompany.get(ck)
    const compact = ck.replace(/\s+/g, '')
    if (compact && index.byCompany.has(compact)) return index.byCompany.get(compact)
  }
  for (const ck of leadCompanyKeys(entry)) {
    for (const [key, packed] of index.byCompany) {
      if (companyKeysLooselyMatch(ck, key)) return packed
    }
  }
  return null
}

export function overlayOwnerUserIds(overlays, ownerIndex, store = null, organizationId = null) {
  const ids = new Set()
  const usersById = new Map((store?.users || []).map((u) => [String(u.id), u]))
  for (const item of overlays || []) {
    const person = canonicalErpOwner(item?.erp || item?.overlay)
    const uid = matchErpOwnerUserId(person, ownerIndex)
    if (!uid) continue
    ids.add(String(uid))
    const user = usersById.get(String(uid)) || {
      id: uid,
      name: ownerIndex?.names?.[uid] || person?.name,
      email: person?.email || null,
    }
    if (store && organizationId) {
      for (const alias of listPipelineActorIds(store, organizationId, user)) {
        ids.add(String(alias))
      }
    }
  }
  return ids
}

export function applyErpOverlayToLeadEntry(
  entry,
  {
    overlayIndex,
    ownerIndex,
    overlayOwnerIds = new Set(),
    profileMap = {},
    reclaimUnmatchedOwners = false,
  } = {}
) {
  if (!entry) return { matched: false, assigned: false, reclaimed: false, changed: false }
  const hit = matchLeadToOverlay(entry, overlayIndex)
  const beforeStatus = entry.crm?.status
  const beforeOrder = entry.crm?.lastOrderCreatedAt
  const beforeOwner = entry.assignedToUserId || null

  if (!hit) {
    stampLastOrderCreatedAt(entry)
    stampTradingProfileFromErp(entry, entry.erp || entry.lead?.erp)
    applyErpAccountStage(entry)
    let reclaimed = false
    if (reclaimUnmatchedOwners) {
      const aid = entry.assignedToUserId ? String(entry.assignedToUserId) : ''
      if (aid && overlayOwnerIds.has(aid)) {
        entry.assignedToUserId = null
        entry.teamId = null
        entry.departmentId = null
        if (entry.erp) entry.erp.ownership = emptyErpOwnership()
        if (entry.lead?.erp) entry.lead.erp.ownership = emptyErpOwnership()
        reclaimed = true
      }
    }
    const changed =
      reclaimed ||
      entry.crm?.status !== beforeStatus ||
      entry.crm?.lastOrderCreatedAt !== beforeOrder ||
      (entry.assignedToUserId || null) !== beforeOwner
    return { matched: false, assigned: false, reclaimed, changed }
  }

  const nextErp = mergeLeadErp(entry.erp || entry.lead?.erp, hit.overlay)
  if (hit.xindusId && !nextErp.revenue?.xindusId) {
    nextErp.revenue = { ...nextErp.revenue, xindusId: hit.xindusId }
  }
  entry.erp = nextErp
  if (entry.lead) entry.lead.erp = nextErp
  stampLastOrderCreatedAt(entry, lastOrderCreatedAtFromErp(nextErp))
  stampTradingProfileFromErp(entry, nextErp)
  applyErpAccountStage(entry)

  const person = canonicalErpOwner(nextErp)
  const ownerUserId = matchErpOwnerUserId(person, ownerIndex)
  entry.assignedToUserId = ownerUserId || null
  let assigned = false
  if (ownerUserId) {
    assigned = true
    const teamId = profileMap[ownerUserId]?.teamId
    if (teamId) {
      entry.teamId = String(teamId)
      if (profileMap[ownerUserId]?.departmentId) {
        entry.departmentId = String(profileMap[ownerUserId].departmentId)
      }
    }
  } else {
    entry.teamId = null
    entry.departmentId = null
  }

  return { matched: true, assigned, reclaimed: false, changed: true }
}

function stampTradingProfileFromErp(entry, erp) {
  const iso = lastOrderCreatedAtFromErp(erp)
  const count = Number(erp?.revenue?.shipmentCount)
  if (!iso && !(Number.isFinite(count) && count > 0)) return
  const profile =
    entry.tradingProfile && typeof entry.tradingProfile === 'object' ? entry.tradingProfile : {}
  const next = {
    ...profile,
    lastShipmentAt: laterIsoTimestamp(profile.lastShipmentAt, iso) || iso || profile.lastShipmentAt,
    lastShipmentDate: erp?.revenue?.lastShipmentDate || profile.lastShipmentDate || null,
  }
  if (Number.isFinite(count) && count > 0) next.shipmentCount = count
  entry.tradingProfile = next
  if (entry.lead) entry.lead.tradingProfile = { ...entry.lead.tradingProfile, ...next }
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
  reclaimUnmatchedOwners = overlays?.length >= 500,
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
  let metaStore = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  const { patchStoreWithFreshOrgRoster } = await import('./teamMembersFresh.js')
  metaStore = await patchStoreWithFreshOrgRoster(metaStore)
  const ownerIndex = buildOwnerMemberIndex(metaStore, organizationId)
  const profileMap = await loadMemberProfilesMap(organizationId).catch(() => ({}))

  const overlayIndex = indexOverlays(overlays)
  const overlayOwnerIds = overlayOwnerUserIds(overlays, ownerIndex, metaStore, organizationId)
  const tableRows = await loadPipelineLeadPage(organizationId, offset, limit)
  const pendingByShard = new Map()
  let matched = 0
  let assigned = 0
  let unassigned = 0
  let reclaimed = 0

  for (const row of tableRows) {
    const entry = row.entry
    if (!entry) continue
    const result = applyErpOverlayToLeadEntry(entry, {
      overlayIndex,
      ownerIndex,
      overlayOwnerIds,
      profileMap,
      reclaimUnmatchedOwners,
    })
    if (result.matched) {
      matched += 1
      if (result.assigned) assigned += 1
      else unassigned += 1
    } else if (result.reclaimed) {
      reclaimed += 1
    }
    if (result.changed) {
      const list = pendingByShard.get(row.shard_name) || []
      list.push(entry)
      pendingByShard.set(row.shard_name, list)
    }
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
    reclaimed,
    nextOffset: offset + tableRows.length,
    done: tableRows.length < limit,
  }
}
