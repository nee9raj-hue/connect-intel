import { listPipelineActorIds } from '../pipelineActorIds.js'
import { mergeLeadErp, normalizeCompanyMatchKey, companyKeysLooselyMatch } from '../leadErp.js'
import { lastOrderCreatedAtFromErp, laterIsoTimestamp, stampLastOrderCreatedAt } from '../leadLastOrder.js'
import { applyErpAccountStage, isErpImportedLead } from '../erpAccountStage.js'
import { xindusIdFromLeadEntry } from '../xindusCustomerErp.js'
import { stampErpTagsOnEntry } from '../erpTags.js'
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
  const erpTags = overlay?.erpTags ?? overlay?.erp_tags
  return {
    revenue: prune(overlay?.revenue),
    finance: prune(overlay?.finance),
    ownership: packedOwners,
    ...(Array.isArray(erpTags) ? { erpTags } : {}),
  }
}

export function taxIdKey(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function shipmentDay(overlay) {
  const rev = overlay?.revenue || {}
  const raw = rev.lastShipmentDate || rev.lastTransactedDate || ''
  const day = String(raw || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : ''
}

function shipmentRank(packed) {
  const day = shipmentDay(packed?.overlay)
  const count = Number(packed?.overlay?.revenue?.shipmentCount) || 0
  if (!day && count <= 0) return 0
  const ms = day ? Date.parse(`${day}T00:00:00.000Z`) : 0
  return (Number.isFinite(ms) ? ms : 0) + count
}

function rememberShipment(map, key, packed) {
  if (!key || !packed) return
  const prev = map.get(key)
  if (!prev || shipmentRank(packed) > shipmentRank(prev)) map.set(key, packed)
}

function hasSalesOwner(packed) {
  const person = canonicalErpOwner(packed?.overlay)
  return Boolean(person && (person.email || person.name))
}

/** Prefer an ops-list owner, then the customer row that actually shipped. */
function preferSalesOwner(current, incoming) {
  if (!current || !hasSalesOwner(current)) return incoming
  if (!incoming || !hasSalesOwner(incoming)) return current
  if (incoming.ownerAuthoritative !== current.ownerAuthoritative) {
    return incoming.ownerAuthoritative ? incoming : current
  }
  const nextRank = shipmentRank(incoming)
  const prevRank = shipmentRank(current)
  if (nextRank !== prevRank) return nextRank > prevRank ? incoming : current
  return incoming
}

function rememberOwner(map, key, packed) {
  if (!key || !packed || !hasSalesOwner(packed)) return
  map.set(key, preferSalesOwner(map.get(key), packed))
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
  const byCompanyShipment = new Map()
  const byPhoneShipment = new Map()
  const byCompanyOwner = new Map()
  const byPhoneOwner = new Map()
  const byIdOwner = new Map()
  for (const item of overlays) {
    const erp = item.erp || item.overlay
    if (!erp) continue
    const packed = {
      overlay: erp,
      ownerAuthoritative: item.ownerAuthoritative === true,
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
    if (packed.phone) rememberShipment(byPhoneShipment, packed.phone, packed)
    if (packed.xindusId) rememberOwner(byIdOwner, packed.xindusId, packed)
    if (packed.phone) rememberOwner(byPhoneOwner, packed.phone, packed)
    for (const raw of [packed.company, item.companyName, item.legalName]) {
      const ck = normalizeCompanyMatchKey(raw)
      if (ck && !byCompany.has(ck)) byCompany.set(ck, packed)
      const compact = ck.replace(/\s+/g, '')
      if (compact && compact !== ck && !byCompany.has(compact)) byCompany.set(compact, packed)
      if (ck) rememberShipment(byCompanyShipment, ck, packed)
      if (compact && compact !== ck) rememberShipment(byCompanyShipment, compact, packed)
      if (ck) rememberOwner(byCompanyOwner, ck, packed)
      if (compact && compact !== ck) rememberOwner(byCompanyOwner, compact, packed)
    }
  }
  return {
    byId,
    byPhone,
    byEmail,
    byCompany,
    byGst,
    byCrn,
    byPan,
    byCrmId,
    byCompanyShipment,
    byPhoneShipment,
    byCompanyOwner,
    byPhoneOwner,
    byIdOwner,
  }
}

/** ERP sales owner for this lead. An ops-list row wins over the stored customer snapshot. */
export function bestSalesOwnerOverlay(index, entry, identityHit = null) {
  if (!index || !entry) return identityHit
  if (identityHit?.ownerAuthoritative && hasSalesOwner(identityHit)) return identityHit
  const candidates = []
  if (identityHit && hasSalesOwner(identityHit)) candidates.push(identityHit)
  const xid = xindusIdFromLeadEntry(entry)
  if (xid && index.byIdOwner?.has(xid)) candidates.push(index.byIdOwner.get(xid))
  const lead = entry.lead || {}
  for (const ck of leadCompanyKeys(entry)) {
    const hit = index.byCompanyOwner?.get(ck) || index.byCompanyOwner?.get(ck.replace(/\s+/g, ''))
    if (hit) candidates.push(hit)
  }
  for (const phone of leadPhoneKeys(lead)) {
    const hit = index.byPhoneOwner?.get(phone)
    if (hit) candidates.push(hit)
  }
  let best = null
  for (const candidate of candidates) best = preferSalesOwner(best, candidate)
  return best || identityHit
}

/**
 * Point the lead at the ERP sales owner when that person is a CRM user.
 * Does not clear the assignee when ERP has no matching person.
 */
export function stampErpSalesOwner(entry, packed, ownerIndex, profileMap = {}) {
  const person = canonicalErpOwner(packed?.overlay)
  if (!entry || !person) return false
  const userId = matchErpOwnerUserId(person, ownerIndex)
  if (!userId) return false
  const before = entry.assignedToUserId ? String(entry.assignedToUserId) : ''
  const erp = entry.erp && typeof entry.erp === 'object' ? entry.erp : {}
  const ownership = {
    ...(erp.ownership && typeof erp.ownership === 'object' ? erp.ownership : {}),
    salesOwner: person,
  }
  const previousEmail = String(erp.ownership?.salesOwner?.email || '').trim().toLowerCase()
  const nextEmail = String(person.email || '').trim().toLowerCase()
  const sameOwner = before === String(userId) && (!nextEmail || previousEmail === nextEmail)
  entry.erp = { ...erp, ownership }
  if (entry.lead) entry.lead.erp = entry.erp
  if (sameOwner) return false
  entry.assignedToUserId = userId
  const teamId = profileMap[userId]?.teamId
  if (teamId) {
    entry.teamId = String(teamId)
    if (profileMap[userId]?.departmentId) {
      entry.departmentId = String(profileMap[userId].departmentId)
    }
  }
  return true
}

/** Latest ERP shipment row for this lead, including a same-name customer the identity match missed. */
export function bestShipmentOverlay(index, entry, identityHit = null) {
  if (!index || !entry) return identityHit
  const candidates = []
  if (identityHit) candidates.push(identityHit)
  const lead = entry.lead || {}
  for (const ck of leadCompanyKeys(entry)) {
    const hit = index.byCompanyShipment?.get(ck) || index.byCompanyShipment?.get(ck.replace(/\s+/g, ''))
    if (hit) candidates.push(hit)
  }
  for (const phone of leadPhoneKeys(lead)) {
    const hit = index.byPhoneShipment?.get(phone)
    if (hit) candidates.push(hit)
  }
  let best = null
  let bestRank = 0
  for (const candidate of candidates) {
    const rank = shipmentRank(candidate)
    if (rank > bestRank) {
      best = candidate
      bestRank = rank
    }
  }
  return best || identityHit
}

/**
 * Copy last shipment / count onto the lead. Does not change owner, tags, or pipeline status.
 * Returns true when the stored shipment date or count changed.
 */
export function stampErpShipmentFacts(entry, packed) {
  const day = shipmentDay(packed?.overlay)
  const rev = packed?.overlay?.revenue || {}
  const count = Number(rev.shipmentCount)
  if (!entry || (!day && !(Number.isFinite(count) && count > 0))) return false
  const erp = entry.erp && typeof entry.erp === 'object' ? entry.erp : {}
  const revenue = { ...(erp.revenue && typeof erp.revenue === 'object' ? erp.revenue : {}) }
  const currentDay = shipmentDay({ revenue })
  let changed = false
  if (day && (!currentDay || day > currentDay)) {
    revenue.lastShipmentDate = day
    revenue.lastTransactedDate = day
    changed = true
  }
  if (rev.firstShipmentAt && !revenue.firstShipmentAt) {
    const first = String(rev.firstShipmentAt).slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
      revenue.firstShipmentAt = first
      changed = true
    }
  }
  if (Number.isFinite(count) && count > (Number(revenue.shipmentCount) || 0)) {
    revenue.shipmentCount = count
    changed = true
  }
  if (packed.xindusId && !revenue.xindusId) {
    revenue.xindusId = packed.xindusId
    changed = true
  }
  if (!changed && entry.crm?.lastOrderCreatedAt) return false
  if (!revenue.lastShipmentDate && !revenue.lastTransactedDate) return false
  entry.erp = { ...erp, revenue }
  if (entry.lead) entry.lead.erp = entry.erp
  const before = entry.crm?.lastOrderCreatedAt || null
  stampLastOrderCreatedAt(entry, lastOrderCreatedAtFromErp(entry.erp))
  stampTradingProfileFromErp(entry, entry.erp)
  return changed || (entry.crm?.lastOrderCreatedAt || null) !== before
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

export function resetErpOwnerMappingOnEntry(entry) {
  if (!entry || typeof entry !== 'object') return { changed: false }
  if (!isErpImportedLead(entry) && !entry.erp?.ownership?.salesOwner && !entry.assignedToUserId) {
    return { changed: false }
  }
  if (!isErpImportedLead(entry)) return { changed: false }
  const before = entry.assignedToUserId || null
  const hadOwner =
    entry.erp?.ownership?.salesOwner ||
    entry.erp?.ownership?.accountOwner ||
    entry.lead?.erp?.ownership?.salesOwner
  entry.assignedToUserId = null
  entry.teamId = null
  entry.departmentId = null
  if (entry.erp) entry.erp.ownership = emptyErpOwnership()
  if (entry.lead?.erp) entry.lead.erp.ownership = emptyErpOwnership()
  const changed = before != null || Boolean(hadOwner)
  return { changed, reclaimed: Boolean(before) }
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
    stampErpShipmentFacts(entry, bestShipmentOverlay(overlayIndex, entry, null))
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
    const ownerStamped = stampErpSalesOwner(
      entry,
      bestSalesOwnerOverlay(overlayIndex, entry, null),
      ownerIndex,
      profileMap
    )
    const changed =
      reclaimed ||
      entry.crm?.status !== beforeStatus ||
      entry.crm?.lastOrderCreatedAt !== beforeOrder ||
      (entry.assignedToUserId || null) !== beforeOwner
    return { matched: false, assigned: ownerStamped, reclaimed, changed }
  }

  const ownerAuthoritative = hit.ownerAuthoritative === true
  const nextErp = mergeLeadErp(entry.erp || entry.lead?.erp, hit.overlay)
  if (hit.xindusId && !nextErp.revenue?.xindusId) {
    nextErp.revenue = { ...nextErp.revenue, xindusId: hit.xindusId }
  }
  if (!ownerAuthoritative) {
    const incomingOwner = canonicalErpOwner(hit.overlay)
    if (!incomingOwner) nextErp.ownership = erpOwnershipKeeping(entry.erp || entry.lead?.erp)
  }
  entry.erp = nextErp
  if (entry.lead) entry.lead.erp = nextErp
  if (Array.isArray(nextErp.erpTags)) {
    stampErpTagsOnEntry(entry, nextErp.erpTags)
  } else if (Array.isArray(hit.overlay?.erpTags) || Array.isArray(hit.overlay?.erp_tags)) {
    stampErpTagsOnEntry(entry, hit.overlay.erpTags ?? hit.overlay.erp_tags)
  }
  stampLastOrderCreatedAt(entry, lastOrderCreatedAtFromErp(nextErp))
  stampTradingProfileFromErp(entry, nextErp)
  stampErpShipmentFacts(entry, bestShipmentOverlay(overlayIndex, entry, hit))
  applyErpAccountStage(entry)

  const ownerPacked = ownerAuthoritative && hasSalesOwner(hit)
    ? hit
    : bestSalesOwnerOverlay(overlayIndex, entry, hit)
  const ownerStamped = stampErpSalesOwner(entry, ownerPacked, ownerIndex, profileMap)
  const changed =
    ownerAuthoritative ||
    ownerStamped ||
    entry.crm?.status !== beforeStatus ||
    entry.crm?.lastOrderCreatedAt !== beforeOrder ||
    (entry.assignedToUserId || null) !== beforeOwner

  return { matched: true, assigned: ownerStamped, reclaimed: false, changed }
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

export async function loadStoredXindusCustomerOverlays() {
  try {
    const rows = await supabaseRest(
      'store_collections?select=json&collection=eq.xindusCustomerErp&limit=1',
      {},
      { timeoutMs: 60_000, attempts: 1 }
    )
    const json = Array.isArray(rows) ? rows[0]?.json : null
    return Array.isArray(json) ? json : []
  } catch (err) {
    console.warn('xindus customer erp snapshot:', err?.message || err)
    return []
  }
}

function withShipmentLookups(identityIndex, shipmentOverlays) {
  if (!identityIndex || !Array.isArray(shipmentOverlays) || !shipmentOverlays.length) return identityIndex
  const extra = indexOverlays(shipmentOverlays)
  identityIndex.byCompanyShipment = extra.byCompanyShipment
  identityIndex.byPhoneShipment = extra.byPhoneShipment
  identityIndex.byCompanyOwner = extra.byCompanyOwner
  identityIndex.byPhoneOwner = extra.byPhoneOwner
  identityIndex.byIdOwner = extra.byIdOwner
  return identityIndex
}

function erpOwnershipKeeping(existing) {
  const ownership = existing?.ownership
  if (!ownership || typeof ownership !== 'object') return emptyErpOwnership()
  return {
    salesOwner: ownership.salesOwner || null,
    accountOwner: ownership.accountOwner || null,
    leadOwner: ownership.leadOwner || null,
  }
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
  shipmentOverlays = null,
  offset = 0,
  limit = 250,
  dryRun = false,
  resetOwners = false,
  reclaimUnmatchedOwners = overlays?.length >= 500,
}) {
  if (offset === 0 && !dryRun) {
    try {
      const { applyPipelineCollaboratorIdsBootstrap } = await import('./supabaseSqlApply.js')
      await applyPipelineCollaboratorIdsBootstrap()
    } catch (err) {
      console.warn('pipeline owner trigger bootstrap:', err?.message || err)
    }
    if (!resetOwners) await ensureErpOwnerMemberships(organizationId, overlays)
  }
  let metaStore = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  const { patchStoreWithFreshOrgRoster } = await import('./teamMembersFresh.js')
  metaStore = await patchStoreWithFreshOrgRoster(metaStore)
  const ownerIndex = buildOwnerMemberIndex(metaStore, organizationId)
  const profileMap = await loadMemberProfilesMap(organizationId).catch(() => ({}))

  const overlayIndex = withShipmentLookups(indexOverlays(overlays), shipmentOverlays)
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
    if (resetOwners) {
      const result = resetErpOwnerMappingOnEntry(entry)
      if (result.reclaimed) reclaimed += 1
      if (result.changed) {
        const list = pendingByShard.get(row.shard_name) || []
        list.push(entry)
        pendingByShard.set(row.shard_name, list)
      }
      continue
    }
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
