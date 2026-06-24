import { lastCrmActivityAtForUser } from './crmTouchpoints.js'
import {
  fetchLastCrmActivityAtByActors,
  isPipelineActivitiesTableEnabled,
} from './pipelineActivitiesTable.js'

function pickLatest(...values) {
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

/** Normalize member rows so Last active always means CRM work by that rep (all orgs). */
export async function enrichIntelMembersLastActive(members = [], { orgId, entries = null } = {}) {
  if (!members?.length) return members

  const actorIds = members.map((m) => String(m.userId)).filter(Boolean)
  let sqlMap = new Map()
  if (orgId && isPipelineActivitiesTableEnabled()) {
    try {
      sqlMap = await fetchLastCrmActivityAtByActors(orgId, actorIds)
    } catch {
      sqlMap = new Map()
    }
  }

  return members.map((member) => {
    const uid = String(member.userId)
    const fromSql = sqlMap.get(uid) || null
    const fromEntries = entries ? lastCrmActivityAtForUser(entries, uid) : null
    const lastActiveAt = pickLatest(fromSql, fromEntries)
    return {
      ...member,
      lastActiveAt,
      lastInAppAt: member.lastInAppAt ?? member.lastLoginAt ?? null,
    }
  })
}

export async function resolveRepLastCrmActivityAt(userId, { orgId, entries = null } = {}) {
  const uid = String(userId || '')
  if (!uid) return null
  const [enriched] = await enrichIntelMembersLastActive([{ userId: uid }], { orgId, entries })
  return enriched?.lastActiveAt || null
}
