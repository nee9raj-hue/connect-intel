import { listPipelineActorIds } from '../pipelineActorIds.js'
import {
  buildOwnerMemberIndex,
  canonicalErpOwner,
  erpPersonMatchesUser,
  matchErpOwnerUserId,
  ownerFirstNameKey,
} from '../erpOwner.js'
import { loadMemberProfilesMap } from './orgHierarchy.js'
import { invalidatePipelineIndex } from './pipelineIndex.js'
import { pipelineOrgShardName } from './pipelineShard.js'
import { readStore } from './store.js'
import { supabaseRest } from './supabaseClient.js'
import { patchStoreWithFreshOrgRoster } from './teamMembersFresh.js'

const META = ['users', 'organizations', 'organizationMemberships']
const PAGE = 250
const CLAIM_COOLDOWN_MS = 30 * 60 * 1000
const claimedAt = new Map()

export function stampEntryErpOwner(entry, ownerIndex, profileMap = {}, { onlyUserId } = {}) {
  if (!entry || typeof entry !== 'object') return { entry, changed: false }
  const person = canonicalErpOwner(entry.erp || entry.lead?.erp)
  const preferUser = ownerIndex?.preferUser
  let ownerUserId = matchErpOwnerUserId(person, ownerIndex, { preferUserId: onlyUserId })
  if (preferUser && erpPersonMatchesUser(person, preferUser)) {
    ownerUserId = String(preferUser.id)
  }
  if (!ownerUserId) return { entry, changed: false }
  if (onlyUserId && String(ownerUserId) !== String(onlyUserId)) return { entry, changed: false }

  const nextAssignee = String(ownerUserId)
  const teamId = profileMap[ownerUserId]?.teamId ? String(profileMap[ownerUserId].teamId) : null
  const departmentId = profileMap[ownerUserId]?.departmentId
    ? String(profileMap[ownerUserId].departmentId)
    : null
  const sameAssignee = String(entry.assignedToUserId || '') === nextAssignee
  const sameTeam = String(entry.teamId || '') === String(teamId || '')
  if (sameAssignee && sameTeam) return { entry, changed: false }

  entry.assignedToUserId = nextAssignee
  if (teamId) entry.teamId = teamId
  if (departmentId) entry.departmentId = departmentId
  return { entry, changed: true }
}

function safeIlikeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function claimOrFilter(user, stubUserIds = []) {
  const email = String(user?.email || '')
    .trim()
    .toLowerCase()
  const token = safeIlikeToken(ownerFirstNameKey(user?.name) || email.split('@')[0])
  const orParts = []
  if (email) {
    const enc = encodeURIComponent(email)
    for (const path of [
      'entry->erp->ownership->salesOwner->>email',
      'entry->erp->ownership->accountOwner->>email',
      'entry->erp->ownership->leadOwner->>email',
    ]) {
      orParts.push(`${path}.eq.${enc}`)
    }
  }
  if (token.length >= 3) {
    const pat = encodeURIComponent(`*${token}*`)
    for (const path of [
      'entry->erp->ownership->salesOwner->>name',
      'entry->erp->ownership->accountOwner->>name',
      'entry->erp->ownership->leadOwner->>name',
    ]) {
      orParts.push(`${path}.ilike.${pat}`)
    }
  }
  for (const stubId of stubUserIds) {
    const enc = encodeURIComponent(String(stubId))
    orParts.push(`owner_id.eq.${enc}`)
    orParts.push(`entry->>assignedToUserId.eq.${enc}`)
  }
  if (!orParts.length) return null
  return `or=(${orParts.join(',')})`
}

function stubUserIdsForClaim(store, organizationId, claimUser) {
  if (!claimUser?.id) return []
  return listPipelineActorIds(store, organizationId, claimUser).filter(
    (id) => String(id) !== String(claimUser.id)
  )
}

async function loadClaimCandidateRows(organizationId, orFilter) {
  if (!orFilter) {
    return { rows: null, targeted: false }
  }
  const rows = []
  let offset = 0
  try {
    for (;;) {
      const path =
        `pipeline_leads?organization_id=eq.${encodeURIComponent(organizationId)}` +
        `&select=lead_id,shard_name,entry&${orFilter}&order=lead_id.asc&limit=${PAGE}&offset=${offset}`
      const page = await supabaseRest(path, {}, { timeoutMs: 45_000 })
      if (!Array.isArray(page) || !page.length) break
      rows.push(...page)
      if (page.length < PAGE) break
      offset += page.length
      if (offset > 40_000) break
    }
    return { rows, targeted: true }
  } catch (err) {
    console.warn('erp owner claim targeted query:', err?.message || err)
    return { rows: null, targeted: false }
  }
}

export async function reassignErpOwnedLeads({ organizationId, onlyUserId, claimUser } = {}) {
  if (!organizationId) return { scanned: 0, updated: 0, assigned: 0 }
  const { loadPipelineLeadPage } = await import('./xindusErpOverlayApply.js')
  const { upsertPipelineLeadRows } = await import('./pipelineLeadsTable.js')

  let metaStore = await readStore({ only: META })
  metaStore = await patchStoreWithFreshOrgRoster(metaStore)
  if (claimUser?.id && !(metaStore.users || []).some((u) => String(u.id) === String(claimUser.id))) {
    metaStore = {
      ...metaStore,
      users: [...(metaStore.users || []), claimUser],
    }
  }

  const ownerIndex = buildOwnerMemberIndex(metaStore, organizationId, {
    preferUserId: onlyUserId || claimUser?.id,
  })
  if (claimUser?.id && !ownerIndex.preferUser) {
    ownerIndex.preferUser = claimUser
  }
  const profileMap = await loadMemberProfilesMap(organizationId).catch(() => ({}))
  const stubIds = onlyUserId ? stubUserIdsForClaim(metaStore, organizationId, claimUser || ownerIndex.preferUser) : []
  const orFilter = onlyUserId && claimUser ? claimOrFilter(claimUser, stubIds) : null
  const targeted = await loadClaimCandidateRows(organizationId, orFilter)

  let offset = 0
  let scanned = 0
  let updated = 0
  let assigned = 0
  let pageRows = targeted.rows

  for (;;) {
    const tableRows = pageRows || (await loadPipelineLeadPage(organizationId, offset, PAGE))
    if (!Array.isArray(tableRows) || !tableRows.length) break
    scanned += tableRows.length
    const pendingByShard = new Map()

    for (const row of tableRows) {
      const entry = row.entry
      if (!entry) continue
      const { changed } = stampEntryErpOwner(entry, ownerIndex, profileMap, { onlyUserId })
      if (!changed) continue
      assigned += 1
      const shardName = row.shard_name
      const list = pendingByShard.get(shardName) || []
      list.push(entry)
      pendingByShard.set(shardName, list)
    }

    for (const [shardName, entries] of pendingByShard) {
      await upsertPipelineLeadRows(shardName, entries, {
        force: true,
        skipMembershipGuard: true,
        skipEnterpriseSync: true,
        batchSize: 50,
      })
      updated += entries.length
    }

    if (pageRows) break
    if (tableRows.length < PAGE) break
    offset += tableRows.length
    if (offset > 40_000) break
  }

  if (updated > 0) {
    invalidatePipelineIndex(pipelineOrgShardName(organizationId))
  }

  return { scanned, updated, assigned, targeted: Boolean(targeted.targeted && pageRows) }
}

export async function claimErpLeadsForMemberOnce(user, { force = false } = {}) {
  const organizationId = user?.organizationId
  const userId = user?.id
  if (!organizationId || !userId) return null
  if (user.accountType && user.accountType !== 'company') return null
  const key = `${organizationId}:${userId}`
  const last = claimedAt.get(key) || 0
  if (!force && Date.now() - last < CLAIM_COOLDOWN_MS) return { skipped: true }
  claimedAt.set(key, Date.now())
  try {
    return await reassignErpOwnedLeads({
      organizationId,
      onlyUserId: userId,
      claimUser: user,
    })
  } catch (err) {
    claimedAt.delete(key)
    console.warn('erp owner lead claim:', err?.message || err)
    return { error: String(err?.message || err) }
  }
}
