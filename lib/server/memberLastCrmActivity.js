import {
  lastCrmActivityAtByActorsFromEntries,
  lastCrmActivityAtForUser,
} from './crmTouchpoints.js'
import {
  fetchLastCrmActivityAtByActors,
  isPipelineActivitiesTableEnabled,
} from './pipelineActivitiesTable.js'

const LAST_ACTIVE_MEM_TTL_MS = 3 * 60 * 1000
const lastActiveMem = new Map()

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

function cacheKey(orgId, actorIds) {
  return `${orgId}:${[...actorIds].sort().join(',')}`
}

function readMemCache(orgId, actorIds) {
  const row = lastActiveMem.get(cacheKey(orgId, actorIds))
  if (!row || Date.now() - row.at > LAST_ACTIVE_MEM_TTL_MS) return null
  return row.map
}

function writeMemCache(orgId, actorIds, map) {
  lastActiveMem.set(cacheKey(orgId, actorIds), { map, at: Date.now() })
}

/**
 * Single CRM-wide resolver for "last active" — SQL per actor first; entry scan only for gaps.
 */
export async function resolveLastCrmActivityMap(user, actorIds = [], { orgId = null, entries = null } = {}) {
  const ids = [...new Set((actorIds || []).map(String).filter(Boolean))]
  const map = new Map()
  if (!ids.length) return map

  const org = orgId || user?.organizationId
  if (org) {
    const cached = readMemCache(org, ids)
    if (cached) return new Map([...cached.entries(), ...ids.filter((id) => !cached.has(id)).map((id) => [id, null])])
  }

  if (org && isPipelineActivitiesTableEnabled()) {
    const sql = await fetchLastCrmActivityAtByActors(org, ids)
    for (const [uid, at] of sql.entries()) map.set(uid, at)
  }

  const missing = ids.filter((id) => !map.get(id))
  if (missing.length > 0) {
    let fromEntries = new Map()
    if (entries?.length) {
      fromEntries = lastCrmActivityAtByActorsFromEntries(entries, missing)
    } else if (user?.organizationId && missing.length > 0) {
      const { loadOrgEntriesForLastActiveScan } = await import('./activityLogCrmFallback.js')
      const scanned = await loadOrgEntriesForLastActiveScan(user)
      if (scanned.length) fromEntries = lastCrmActivityAtByActorsFromEntries(scanned, missing)
    }
    for (const [uid, at] of fromEntries.entries()) {
      map.set(uid, pickLatestCrmActivityAt(map.get(uid), at))
    }
  }

  for (const uid of ids) {
    if (!map.has(uid)) map.set(uid, null)
  }

  if (org) writeMemCache(org, ids, map)
  return map
}

export async function resolveRepLastCrmActivityAt(userId, { user = null, orgId = null, entries = null } = {}) {
  const uid = String(userId || '')
  if (!uid) return null
  if (entries?.length) return lastCrmActivityAtForUser(entries, uid)
  const map = await resolveLastCrmActivityMap(user, [uid], { orgId, entries })
  return map.get(uid) || null
}

/** Normalize member rows — last active from SQL index (fast path on hot dashboard loads). */
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
