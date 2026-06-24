import { sanitizeCrmForTenant } from './tenantIsolation.js'

/** Same global cap as GET /api/crm/activity-log — KPIs must match the log panel. */
export const ACTIVITY_FEED_LIMIT = 500

export function resolveEntryCrm(entry) {
  if (entry?.crm && typeof entry.crm === 'object') return entry.crm
  if (entry?.lead?.crm && typeof entry.lead.crm === 'object') return entry.lead.crm
  return {}
}

export function inActivityPeriod(iso, since, until = Infinity) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && t >= since && t < until
}

export function emptyActivityRollup() {
  return {
    emails: 0,
    calls: 0,
    whatsapp: 0,
    meetings: 0,
    tasksCreated: 0,
    tasksCompleted: 0,
    notes: 0,
    statusChanges: 0,
    newLeads: 0,
    leadsTouched: 0,
    contactsOpened: 0,
    activitiesTotal: 0,
  }
}

function incrementFromActivityType(stats, type) {
  const t = String(type || '').toLowerCase()
  if (t === 'email') stats.emails += 1
  else if (t === 'call') stats.calls += 1
  else if (t === 'whatsapp') stats.whatsapp += 1
  else if (t === 'meeting' || t === 'field_visit') stats.meetings += 1
  else if (t === 'task') stats.tasksCreated += 1
  else if (t === 'note') stats.notes += 1
  else if (t === 'status' || t === 'assignment' || t === 'transfer') stats.statusChanges += 1
  else if (t === 'lead') stats.newLeads += 1
  if (t && t !== 'email_bounce') stats.activitiesTotal += 1
}

function activityActorId(act) {
  return String(act?.createdByUserId || act?.userId || '')
}

/** Sanitize CRM the same way for activity log and dashboard rollups. */
export function buildSanitizedPipelineRows(store, user, entries) {
  return (entries || []).map((entry) => ({
    ...entry,
    crm: sanitizeCrmForTenant(store, user, resolveEntryCrm(entry), entry),
  }))
}

function activityDedupeKey(act, leadId) {
  if (act?.id) return `id:${act.id}`
  return `fallback:${leadId}:${act?.type}:${act?.createdAt}:${act?.summary}`
}

function collectPeriodActivities(rows, { since, until = Infinity, memberUserId = null, activityType = null } = {}) {
  const mid = memberUserId ? String(memberUserId) : null
  const typeFilter = activityType ? String(activityType).trim().toLowerCase() : null
  const activities = []
  const seen = new Set()

  for (const entry of rows) {
    const lead = entry.lead || {}
    const leadId = lead.id || entry.id
    const assignee = String(entry.assignedToUserId || entry.savedByUserId || entry.userId || '')
    const leadName =
      [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || 'Lead'
    const crm = entry.crm && typeof entry.crm === 'object' ? entry.crm : {}
    const acts = Array.isArray(crm.activities) ? crm.activities : []

    for (const act of acts) {
      const dedupeKey = activityDedupeKey(act, leadId)
      if (seen.has(dedupeKey)) continue
      if (since != null && !inActivityPeriod(act.createdAt, since, until)) continue
      const actor = activityActorId(act)
      if (mid) {
        const matchesActor = actor === mid
        const matchesAssignee = !actor && assignee === mid
        if (!matchesActor && !matchesAssignee) continue
      }
      if (typeFilter && String(act.type || '').toLowerCase() !== typeFilter) continue
      seen.add(dedupeKey)
      activities.push({
        ...act,
        createdByUserId: act.createdByUserId || act.userId || (assignee === mid ? mid : undefined),
        leadId,
        leadName,
        company: lead.company,
      })
    }
  }

  activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return activities
}

/**
 * List CRM activities — shared by activity log and dashboard KPI rollups.
 * Filters by period first, then applies feed/response limits (not a global cap before period).
 */
export function listCrmActivities(
  store,
  user,
  entries,
  {
    since,
    until = Infinity,
    memberUserId = null,
    activityType = null,
    feedLimit = ACTIVITY_FEED_LIMIT,
    responseLimit = null,
  } = {}
) {
  const rows = buildSanitizedPipelineRows(store, user, entries)
  let activities = collectPeriodActivities(rows, { since, until, memberUserId, activityType })

  const limit = feedLimit == null || feedLimit <= 0 ? 0 : feedLimit
  if (limit > 0) activities = activities.slice(0, limit)

  if (responseLimit != null && responseLimit > 0) {
    activities = activities.slice(0, responseLimit)
  }

  return activities
}

/** Roll up org + per-user KPI counts from the same activity list as the log. */
export function countCrmActivities(store, user, entries, opts = {}) {
  const { feedLimit = 0, responseLimit, ...rest } = opts
  const activities = listCrmActivities(store, user, entries, {
    ...rest,
    feedLimit,
    responseLimit: responseLimit ?? null,
  })
  const org = emptyActivityRollup()
  const byUser = new Map()

  const touch = (uid, leadId, type) => {
    incrementFromActivityType(org, type)
    if (!uid) return
    if (!byUser.has(uid)) byUser.set(uid, { ...emptyActivityRollup(), touched: new Set() })
    const row = byUser.get(uid)
    incrementFromActivityType(row, type)
    if (leadId) row.touched.add(String(leadId))
  }

  for (const act of activities) {
    touch(activityActorId(act), act.leadId, act.type)
  }

  org.leadsTouched = new Set([...byUser.values()].flatMap((row) => [...(row.touched || [])])).size
  org.contactsOpened = org.leadsTouched

  const perUser = new Map()
  for (const [uid, row] of byUser.entries()) {
    row.leadsTouched = row.touched.size
    row.contactsOpened = row.touched.size
    delete row.touched
    perUser.set(uid, row)
  }

  return { org, perUser, activities }
}
