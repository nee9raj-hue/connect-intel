import { buildOwnerMemberIndex, canonicalErpOwner, matchErpOwnerUserId } from '../erpOwner.js'
import { loadMemberProfilesMap } from './orgHierarchy.js'
import { readStore } from './store.js'

const META = ['users', 'organizations', 'organizationMemberships']
const PAGE = 250
const CLAIM_COOLDOWN_MS = 30 * 60 * 1000
const claimedAt = new Map()

export function stampEntryErpOwner(entry, ownerIndex, profileMap = {}, { onlyUserId } = {}) {
  if (!entry || typeof entry !== 'object') return { entry, changed: false }
  const person = canonicalErpOwner(entry.erp || entry.lead?.erp)
  const ownerUserId = matchErpOwnerUserId(person, ownerIndex)
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

export async function reassignErpOwnedLeads({ organizationId, onlyUserId } = {}) {
  if (!organizationId) return { scanned: 0, updated: 0, assigned: 0 }
  const { loadPipelineLeadPage } = await import('./xindusErpOverlayApply.js')
  const { upsertPipelineLeadRows } = await import('./pipelineLeadsTable.js')

  const metaStore = await readStore({ only: META })
  const ownerIndex = buildOwnerMemberIndex(metaStore, organizationId)
  const profileMap = await loadMemberProfilesMap(organizationId).catch(() => ({}))

  let offset = 0
  let scanned = 0
  let updated = 0
  let assigned = 0

  for (;;) {
    const tableRows = await loadPipelineLeadPage(organizationId, offset, PAGE)
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

    if (tableRows.length < PAGE) break
    offset += tableRows.length
    if (offset > 40_000) break
  }

  return { scanned, updated, assigned }
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
    return await reassignErpOwnedLeads({ organizationId, onlyUserId: userId })
  } catch (err) {
    claimedAt.delete(key)
    console.warn('erp owner lead claim:', err?.message || err)
    return { error: String(err?.message || err) }
  }
}
