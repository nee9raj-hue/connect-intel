import {
  lastCrmActivityAtByActorsFromEntries,
  lastCrmActivityAtForUser,
} from './crmTouchpoints.js'
import {
  fetchLastCrmActivityAtByActors,
  isPipelineActivitiesTableEnabled,
} from './pipelineActivitiesTable.js'

export function pickLatestCrmActivityAt(...values) {
  let max = 0
  let iso = null
  for (const raw of values) {
    if (!raw) continue
    const t = new Date(raw).getTime()
    if (!Number.isNaN(t) && t > max) {
      max = t
      iso = new Date(t).toISOString()
    }
  }
  return iso
}

/**
 * Single CRM-wide resolver for "last active" — SQL index, then activity-log entry scan.
 * Strict actor only; never lead assignee, pulse, or login.
 */
export async function resolveLastCrmActivityMap(user, actorIds = [], { orgId = null, entries = null } = {}) {
  const ids = [...new Set((actorIds || []).map(String).filter(Boolean))]
  const map = new Map()
  if (!ids.length) return map

  const org = orgId || user?.organizationId
  if (org && isPipelineActivitiesTableEnabled()) {
    const sql = await fetchLastCrmActivityAtByActors(org, ids)
    for (const [uid, at] of sql.entries()) map.set(uid, at)
  }

  let fromEntries = new Map()
  if (entries?.length) {
    fromEntries = lastCrmActivityAtByActorsFromEntries(entries, ids)
  } else if (user?.organizationId) {
    const { loadOrgEntriesForLastActiveScan } = await import('./activityLogCrmFallback.js')
    const scanned = await loadOrgEntriesForLastActiveScan(user)
    if (scanned.length) fromEntries = lastCrmActivityAtByActorsFromEntries(scanned, ids)
  }

  for (const [uid, at] of fromEntries.entries()) {
    map.set(uid, pickLatestCrmActivityAt(map.get(uid), at))
  }

  for (const uid of ids) {
    if (!map.has(uid)) map.set(uid, null)
  }

  return map
}

export async function resolveRepLastCrmActivityAt(userId, { user = null, orgId = null, entries = null } = {}) {
  const uid = String(userId || '')
  if (!uid) return null
  if (entries?.length) return lastCrmActivityAtForUser(entries, uid)
  const map = await resolveLastCrmActivityMap(user, [uid], { orgId, entries })
  return map.get(uid) || null
}

/** Normalize member rows so Last active matches Recent activity / activity log (all orgs). */
export async function enrichIntelMembersLastActive(members = [], { orgId, user = null, entries = null } = {}) {
  if (!members?.length) return members

  const actorIds = members.map((m) => String(m.userId)).filter(Boolean)
  const lastMap = await resolveLastCrmActivityMap(user, actorIds, { orgId, entries })

  return members.map((member) => {
    const uid = String(member.userId)
    return {
      ...member,
      lastActiveAt: lastMap.get(uid) || null,
      lastInAppAt: member.lastInAppAt ?? member.lastLoginAt ?? null,
    }
  })
}
