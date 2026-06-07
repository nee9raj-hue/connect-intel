import { normalizeExtendedCrm, buildActivityFeed } from './crmWorkflow.js'
import { pipelineEntryFreshness } from './pipelineShard.js'

export function inActivityPeriod(iso, since, until = Infinity) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && t >= since && t < until
}

export function resolveEntryCrm(entry) {
  if (entry?.crm && typeof entry.crm === 'object') return entry.crm
  if (entry?.lead?.crm && typeof entry.lead.crm === 'object') return entry.lead.crm
  return {}
}

function hasEmailActivityNear(activities, sentAt) {
  const sentMs = new Date(sentAt).getTime()
  if (Number.isNaN(sentMs)) return false
  return (activities || []).some((a) => {
    if (a.type !== 'email') return false
    const actMs = new Date(a.createdAt).getTime()
    return !Number.isNaN(actMs) && Math.abs(actMs - sentMs) < 120000
  })
}

export function bucketTouchpointType(type) {
  const t = String(type || '').toLowerCase()
  if (t === 'email' || t === 'email_inbound') return 'email'
  if (t === 'call') return 'call'
  if (t === 'whatsapp') return 'whatsapp'
  if (t === 'meeting' || t === 'field_visit') return 'meeting'
  if (t === 'task') return 'task'
  if (t === 'note') return 'note'
  if (t === 'status' || t === 'assignment' || t === 'transfer') return 'status'
  if (t === 'lead') return 'lead'
  return 'other'
}

function entryAssignee(entry) {
  return String(entry.assignedToUserId || entry.savedByUserId || entry.userId || '')
}

/** Who performed the action — strict mode never falls back to lead assignee. */
export function resolveTouchpointActor({ createdByUserId, userId, sentByUserId, assignedToUserId } = {}, entry, { strict = false } = {}) {
  const actor = createdByUserId || userId || sentByUserId || assignedToUserId
  if (actor) return String(actor)
  if (strict) return ''
  return entryAssignee(entry)
}

function rawCrmLists(entry) {
  const raw = resolveEntryCrm(entry)
  const crm = normalizeExtendedCrm(raw)
  return {
    raw,
    crm,
    activities: Array.isArray(raw.activities) ? raw.activities : crm.activities || [],
    emails: Array.isArray(raw.emails) ? raw.emails : crm.emails || [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : crm.tasks || [],
    meetings: Array.isArray(raw.meetings) ? raw.meetings : crm.meetings || [],
  }
}

function actorMatchesFilter(actorUserId, filterUserId) {
  if (!filterUserId) return true
  return String(actorUserId || '') === String(filterUserId)
}

/** Touchpoints for charts — includes CRM activities, sent emails, tasks, and new pipeline adds. */
export function collectTouchpoints(entry, since, until = Infinity, { actorUserId = null, strictActor = true } = {}) {
  const { raw, crm, activities, emails, tasks, meetings } = rawCrmLists(entry)
  const assignee = entryAssignee(entry)
  const points = []

  for (const act of activities) {
    if (!inActivityPeriod(act.createdAt, since, until)) continue
    const actor = resolveTouchpointActor(act, entry, { strict: strictActor })
    if (!actorMatchesFilter(actor, actorUserId)) continue
    points.push({
      at: act.createdAt,
      type: act.type || 'note',
      actorUserId: actor,
    })
  }

  if (
    crm.lastCommunicationAt &&
    inActivityPeriod(crm.lastCommunicationAt, since, until) &&
    crm.lastCommunicationSummary &&
    !points.some(
      (p) => Math.abs(new Date(p.at).getTime() - new Date(crm.lastCommunicationAt).getTime()) < 120000
    )
  ) {
    const actor = strictActor ? '' : assignee
    if (actorMatchesFilter(actor, actorUserId)) {
      points.push({
        at: crm.lastCommunicationAt,
        type: crm.lastCommunicationType || 'note',
        actorUserId: actor,
      })
    }
  }

  for (const task of tasks) {
    if (task.createdAt && inActivityPeriod(task.createdAt, since, until)) {
      const actor = resolveTouchpointActor(task, entry, { strict: strictActor })
      if (!actorMatchesFilter(actor, actorUserId)) continue
      points.push({ at: task.createdAt, type: 'task', actorUserId: actor })
    }
  }

  for (const meeting of meetings) {
    if (meeting.createdAt && inActivityPeriod(meeting.createdAt, since, until)) {
      const actor = resolveTouchpointActor(meeting, entry, { strict: strictActor })
      if (!actorMatchesFilter(actor, actorUserId)) continue
      points.push({ at: meeting.createdAt, type: 'meeting', actorUserId: actor })
    }
  }

  for (const em of emails) {
    if (!em.sentAt || !inActivityPeriod(em.sentAt, since, until)) continue
    if (hasEmailActivityNear(activities, em.sentAt)) continue
    const actor = resolveTouchpointActor(em, entry, { strict: strictActor })
    if (!actorMatchesFilter(actor, actorUserId)) continue
    points.push({ at: em.sentAt, type: 'email', actorUserId: actor })
  }

  if (entry.savedAt && inActivityPeriod(entry.savedAt, since, until)) {
    const actor = resolveTouchpointActor(
      { createdByUserId: entry.savedByUserId },
      entry,
      { strict: strictActor }
    )
    if (actorMatchesFilter(actor, actorUserId)) {
      points.push({ at: entry.savedAt, type: 'lead', actorUserId: actor })
    }
  }

  return points
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

function incrementRollup(stats, bucket) {
  if (bucket === 'email') stats.emails += 1
  else if (bucket === 'call') stats.calls += 1
  else if (bucket === 'whatsapp') stats.whatsapp += 1
  else if (bucket === 'meeting') stats.meetings += 1
  else if (bucket === 'task') stats.tasksCreated += 1
  else if (bucket === 'note') stats.notes += 1
  else if (bucket === 'status') stats.statusChanges += 1
  else if (bucket === 'lead') stats.newLeads += 1
  stats.activitiesTotal += 1
}

/** Same entry selection strategy as the CRM activity log (recent pipeline rows first). */
export function recentPipelineEntriesForActivity(entries, limit = 800) {
  return (entries || [])
    .slice()
    .sort((a, b) => {
      const tb = pipelineEntryFreshness(b) || new Date(b.savedAt || 0).getTime()
      const ta = pipelineEntryFreshness(a) || new Date(a.savedAt || 0).getTime()
      return tb - ta
    })
    .slice(0, Math.max(1, limit))
}

/** Roll up CRM touchpoints for org + per-user stats (used by team dashboard KPIs). */
export function rollupPipelineActivity(entries, since, until = Infinity, { actorUserId = null } = {}) {
  const org = emptyActivityRollup()
  const byUser = new Map()
  const touched = new Set()
  const filterId = actorUserId ? String(actorUserId) : null

  for (const entry of entries || []) {
    const entryId = entry.id || entry.lead?.id
    const { tasks } = rawCrmLists(entry)

    for (const point of collectTouchpoints(entry, since, until, { actorUserId: filterId, strictActor: true })) {
      const bucket = bucketTouchpointType(point.type)
      incrementRollup(org, bucket)
      if (entryId) touched.add(String(entryId))

      const uid = point.actorUserId || ''
      if (!uid) continue
      if (!byUser.has(uid)) byUser.set(uid, { ...emptyActivityRollup(), touched: new Set() })
      const row = byUser.get(uid)
      incrementRollup(row, bucket)
      if (entryId) row.touched.add(String(entryId))
    }

    for (const task of tasks) {
      if (!task.completedAt || !inActivityPeriod(task.completedAt, since, until)) continue
      const uid = resolveTouchpointActor(task, entry, { strict: true })
      if (!uid || !actorMatchesFilter(uid, filterId)) continue
      if (!byUser.has(uid)) byUser.set(uid, { ...emptyActivityRollup(), touched: new Set() })
      byUser.get(uid).tasksCompleted += 1
    }
  }

  org.leadsTouched = touched.size
  org.contactsOpened = touched.size

  const perUser = new Map()
  for (const [uid, row] of byUser.entries()) {
    row.leadsTouched = row.touched.size
    row.contactsOpened = row.touched.size
    delete row.touched
    perUser.set(uid, row)
  }

  return { org, perUser }
}

/** Roll up CRM touchpoints for org + per-user stats (used by team dashboard KPIs). */
export function rollupFromActivityFeed(entries, since, until = Infinity) {
  const org = emptyActivityRollup()
  const byUser = new Map()
  const touched = new Set()

  for (const entry of entries || []) {
    const crm = resolveEntryCrm(entry)
    const assignee = String(entry.assignedToUserId || entry.savedByUserId || entry.userId || '')
    const entryId = entry.id || entry.lead?.id

    for (const act of crm.activities || []) {
      if (!inActivityPeriod(act.createdAt, since, until)) continue
      const bucket = bucketTouchpointType(act.type)
      incrementRollup(org, bucket)
      if (entryId) touched.add(String(entryId))

      const uid = String(act.createdByUserId || act.userId || assignee || '')
      if (uid) {
        if (!byUser.has(uid)) byUser.set(uid, { ...emptyActivityRollup(), touched: new Set() })
        const row = byUser.get(uid)
        incrementRollup(row, bucket)
        if (entryId) row.touched.add(String(entryId))
      }
    }

    for (const task of crm.tasks || []) {
      if (task.completedAt && inActivityPeriod(task.completedAt, since, until)) {
        const uid = String(task.assignedToUserId || task.createdByUserId || assignee || '')
        if (uid && byUser.has(uid)) byUser.get(uid).tasksCompleted += 1
      }
    }
  }

  org.leadsTouched = touched.size
  org.contactsOpened = touched.size

  const perUser = new Map()
  for (const [uid, row] of byUser.entries()) {
    row.leadsTouched = row.touched.size
    row.contactsOpened = row.touched.size
    delete row.touched
    perUser.set(uid, row)
  }

  return { org, perUser }
}

function maxStat(a, b) {
  return Math.max(Number(a) || 0, Number(b) || 0)
}

export function mergeActivityRollups(primary, secondary) {
  const org = { ...emptyActivityRollup(), ...(primary?.org || {}) }
  const alt = secondary?.org || {}
  for (const key of Object.keys(org)) {
    org[key] = maxStat(org[key], alt[key])
  }

  const perUser = new Map(primary?.perUser || [])
  for (const [uid, stats] of secondary?.perUser || []) {
    if (!perUser.has(uid)) {
      perUser.set(uid, { ...stats })
      continue
    }
    const row = { ...perUser.get(uid) }
    for (const key of Object.keys(emptyActivityRollup())) {
      row[key] = maxStat(row[key], stats[key])
    }
    perUser.set(uid, row)
  }

  return { org, perUser }
}

/** Leads to scan for KPIs — recent rows plus any row with activity in the window(s). */
export function entriesForActivityScan(allEntries, since, until = Infinity, recentLimit = 800) {
  return entriesForActivityScanWindows(allEntries, [{ since, until }], recentLimit)
}

function entryHasActivityInWindows(raw, windows) {
  if (!raw || typeof raw !== 'object') return false
  if (raw.lastCommunicationAt) {
    const t = new Date(raw.lastCommunicationAt).getTime()
    if (!Number.isNaN(t)) {
      for (const { since, until } of windows) {
        if (t >= since && t < until) return true
      }
    }
  }
  for (const act of raw.activities || []) {
    const t = new Date(act.createdAt).getTime()
    if (Number.isNaN(t)) continue
    for (const { since, until } of windows) {
      if (t >= since && t < until) return true
    }
  }
  for (const em of raw.emails || []) {
    const t = new Date(em.sentAt).getTime()
    if (Number.isNaN(t)) continue
    for (const { since, until } of windows) {
      if (t >= since && t < until) return true
    }
  }
  for (const task of raw.tasks || []) {
    for (const iso of [task.createdAt, task.completedAt]) {
      const t = new Date(iso).getTime()
      if (Number.isNaN(iso) || Number.isNaN(t)) continue
      for (const { since, until } of windows) {
        if (t >= since && t < until) return true
      }
    }
  }
  for (const meeting of raw.meetings || []) {
    for (const iso of [meeting.createdAt, meeting.scheduledAt]) {
      const t = new Date(iso).getTime()
      if (!iso || Number.isNaN(t)) continue
      for (const { since, until } of windows) {
        if (t >= since && t < until) return true
      }
    }
  }
  return false
}

function entriesForActivityScanWindows(allEntries, windows, recentLimit = 800) {
  const byId = new Map()
  const add = (entry) => {
    const id = entry?.id || entry?.lead?.id
    if (id) byId.set(String(id), entry)
  }

  for (const entry of recentPipelineEntriesForActivity(allEntries, recentLimit)) add(entry)

  for (const entry of (allEntries || [])
    .slice()
    .sort((a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime())
    .slice(0, recentLimit)) {
    add(entry)
  }

  for (const entry of allEntries || []) {
    if (entryHasActivityInWindows(resolveEntryCrm(entry), windows)) add(entry)
  }

  return [...byId.values()]
}

/** Current + previous period rollups in one scan pass (team dashboard). */
export function buildActivityRollupsForPeriods(
  entries,
  currentSince,
  prevSince,
  prevUntil,
  { actorUserId = null } = {}
) {
  const all = entries || []
  const opts = { actorUserId }
  return {
    current: rollupPipelineActivity(all, currentSince, Infinity, opts),
    previous: rollupPipelineActivity(all, prevSince, prevUntil, opts),
  }
}

/** Count activities from raw CRM JSON (no heavy normalize pass). */
function rollupRawActivities(entries, since, until = Infinity) {
  const org = emptyActivityRollup()
  const byUser = new Map()
  const touched = new Set()

  const touch = (uid, entryId, bucket) => {
    incrementRollup(org, bucket)
    if (entryId) touched.add(String(entryId))
    if (!uid) return
    if (!byUser.has(uid)) byUser.set(uid, { ...emptyActivityRollup(), touched: new Set() })
    const row = byUser.get(uid)
    incrementRollup(row, bucket)
    if (entryId) row.touched.add(String(entryId))
  }

  for (const entry of entries || []) {
    const raw = resolveEntryCrm(entry)
    const assignee = String(entry.assignedToUserId || entry.savedByUserId || entry.userId || '')
    const entryId = entry.id || entry.lead?.id

    for (const act of raw.activities || []) {
      if (!inActivityPeriod(act.createdAt, since, until)) continue
      touch(String(act.createdByUserId || act.userId || assignee || ''), entryId, bucketTouchpointType(act.type))
    }

    if (
      raw.lastCommunicationAt &&
      inActivityPeriod(raw.lastCommunicationAt, since, until) &&
      raw.lastCommunicationSummary &&
      !(raw.activities || []).some(
        (a) =>
          inActivityPeriod(a.createdAt, since, until) &&
          Math.abs(new Date(a.createdAt).getTime() - new Date(raw.lastCommunicationAt).getTime()) < 120000
      )
    ) {
      touch(assignee, entryId, bucketTouchpointType(raw.lastCommunicationType || 'note'))
    }

    for (const task of raw.tasks || []) {
      if (task.createdAt && inActivityPeriod(task.createdAt, since, until)) {
        touch(String(task.createdByUserId || task.assignedToUserId || assignee || ''), entryId, 'task')
      }
      if (task.completedAt && inActivityPeriod(task.completedAt, since, until)) {
        const uid = String(task.assignedToUserId || task.createdByUserId || assignee || '')
        if (uid && byUser.has(uid)) byUser.get(uid).tasksCompleted += 1
      }
    }

    for (const meeting of raw.meetings || []) {
      if (meeting.createdAt && inActivityPeriod(meeting.createdAt, since, until)) {
        touch(String(meeting.createdByUserId || assignee || ''), entryId, 'meeting')
      }
    }

    for (const em of raw.emails || []) {
      if (!em.sentAt || !inActivityPeriod(em.sentAt, since, until)) continue
      const nearActivity = (raw.activities || []).some(
        (a) =>
          (a.type === 'email' || a.type === 'email_inbound') &&
          inActivityPeriod(a.createdAt, since, until) &&
          Math.abs(new Date(a.createdAt).getTime() - new Date(em.sentAt).getTime()) < 120000
      )
      if (nearActivity) continue
      const uid = String(em.sentByUserId || em.createdByUserId || assignee || '')
      touch(uid, entryId, 'email')
    }

    if (entry.savedAt && inActivityPeriod(entry.savedAt, since, until)) {
      touch(String(entry.savedByUserId || assignee || ''), entryId, 'lead')
    }
  }

  org.leadsTouched = touched.size
  org.contactsOpened = touched.size

  const perUser = new Map()
  for (const [uid, row] of byUser.entries()) {
    row.leadsTouched = row.touched.size
    row.contactsOpened = row.touched.size
    delete row.touched
    perUser.set(uid, row)
  }
  return { org, perUser }
}

/** Roll up CRM touchpoints for org + per-user stats (used by team dashboard KPIs). */
export function buildActivityRollup(entries, since, until = Infinity) {
  return rollupPipelineActivity(entries || [], since, until)
}
