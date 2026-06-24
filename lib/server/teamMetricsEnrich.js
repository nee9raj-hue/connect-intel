import { emptyActivityRollup } from './crmActivityCounts.js'
import { memberOptionsFromTeam } from './teamMembersFresh.js'

function rollupFromMap(map, uid) {
  if (!map) return null
  return map.get?.(String(uid)) || map[String(uid)] || null
}

/** Apply per-user activity rollups onto teamIntelligence.members (same period as KPI pills). */
export function syncTeamIntelligenceMembers(payload, perUserRollups, rosterMembers = []) {
  if (!payload || !perUserRollups?.size) return payload
  const intel = payload.teamIntelligence || {}
  const existing = new Map((intel.members || []).map((m) => [String(m.userId), m]))

  const roster = rosterMembers?.length
    ? rosterMembers
    : intel.members?.length
      ? intel.members
      : [...perUserRollups.keys()].map((userId) => existing.get(String(userId)) || { userId, name: 'Member' })

  const rosterList = [...roster]
  const rosterIds = new Set(rosterList.map((m) => String(m.userId)))
  for (const uid of perUserRollups.keys()) {
    if (!rosterIds.has(String(uid))) {
      const base = existing.get(String(uid))
      rosterList.push(base || { userId: uid, name: base?.name || 'Member' })
      rosterIds.add(String(uid))
    }
  }

  const members = rosterList.map((m) => {
    const uid = String(m.userId)
    const act = rollupFromMap(perUserRollups, uid)
    const base = existing.get(uid) || m
    if (!act) {
      return {
        ...base,
        name: base.name || m.name,
        emails: base.emails ?? 0,
        calls: base.calls ?? 0,
        activitiesTotal: base.activitiesTotal ?? 0,
        tasksCreated: base.tasksCreated ?? 0,
      }
    }
    return {
      ...base,
      name: base.name || m.name,
      emails: act.emails ?? 0,
      calls: act.calls ?? 0,
      meetings: act.meetings ?? base.meetings ?? 0,
      tasksCreated: act.tasksCreated ?? 0,
      notes: act.notes ?? base.notes ?? 0,
      whatsapp: act.whatsapp ?? base.whatsapp ?? 0,
      activitiesTotal: act.activitiesTotal ?? 0,
      leadsTouched: act.leadsTouched ?? base.leadsTouched ?? 0,
      contactsOpened: act.contactsOpened ?? act.leadsTouched ?? base.contactsOpened ?? 0,
    }
  })

  members.sort((a, b) => (b.activitiesTotal || 0) - (a.activitiesTotal || 0))

  return {
    ...payload,
    teamIntelligence: {
      ...intel,
      members,
    },
  }
}

/** Build memberOptions from roster + intelligence members so filters match the rep table. */
export function memberOptionsFromIntel(rosterMembers = [], intelMembers = []) {
  const map = new Map()
  for (const m of rosterMembers || []) {
    if (m?.userId) map.set(String(m.userId), { userId: m.userId, name: m.name })
  }
  for (const m of intelMembers || []) {
    if (m?.userId) map.set(String(m.userId), { userId: m.userId, name: m.name })
  }
  return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

/**
 * Per-user activity counts from CRM lead data (same source as activity-log CRM fallback).
 * One org scan — used to align rep table with KPI pills.
 */
export async function loadPerUserRollupsFromCrm(user, { since, until, prevSince, prevUntil } = {}) {
  const { readActivityLogFromCrmEntries } = await import('./activityLogCrmFallback.js')
  const result = await readActivityLogFromCrmEntries(user, {
    since,
    until,
    prevSince,
    prevUntil,
    limit: 0,
    offset: 0,
  })
  if (!result?.perUser?.size) return null
  return {
    current: result.perUser,
    previous: result.prevPerUser || new Map(),
  }
}

export function sumMemberRollup(members = [], key = 'activitiesTotal') {
  return (members || []).reduce((n, m) => n + (Number(m[key]) || 0), 0)
}

export function emptyRollup() {
  return emptyActivityRollup()
}
