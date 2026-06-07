import { buildActivityFeed } from './crmWorkflow.js'
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

/**
 * List CRM activities — shared by activity log and dashboard KPI rollups.
 * Uses the same feed limit, period window, and actor filter as the log API.
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
  const limit = feedLimit == null || feedLimit <= 0 ? 0 : feedLimit
  let activities = buildActivityFeed(rows, { limit })

  if (since != null) {
    activities = activities.filter((a) => inActivityPeriod(a.createdAt, since, until))
  }

  if (memberUserId) {
    const mid = String(memberUserId)
    activities = activities.filter((a) => activityActorId(a) === mid)
  }

  if (activityType) {
    const type = String(activityType).trim().toLowerCase()
    activities = activities.filter((a) => String(a.type || '').toLowerCase() === type)
  }

  if (responseLimit != null && responseLimit > 0) {
    activities = activities.slice(0, responseLimit)
  }

  return activities
}

/** Roll up org + per-user KPI counts from the same activity list as the log. */
export function countCrmActivities(store, user, entries, opts = {}) {
  const activities = listCrmActivities(store, user, entries, opts)
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
