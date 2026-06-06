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

/** Touchpoints for charts — includes CRM activities, sent emails, tasks, and new pipeline adds. */
export function collectTouchpoints(entry, since, until = Infinity) {
  const crm = normalizeExtendedCrm(resolveEntryCrm(entry))
  const assignee = String(entry.assignedToUserId || entry.savedByUserId || entry.userId || '')
  const points = []

  for (const act of crm.activities || []) {
    if (!inActivityPeriod(act.createdAt, since, until)) continue
    points.push({
      at: act.createdAt,
      type: act.type || 'note',
      actorUserId: String(act.createdByUserId || act.userId || assignee || ''),
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
    points.push({
      at: crm.lastCommunicationAt,
      type: crm.lastCommunicationType || 'note',
      actorUserId: assignee,
    })
  }

  for (const task of crm.tasks || []) {
    if (task.createdAt && inActivityPeriod(task.createdAt, since, until)) {
      points.push({
        at: task.createdAt,
        type: 'task',
        actorUserId: String(task.createdByUserId || task.assignedToUserId || assignee || ''),
      })
    }
  }

  for (const meeting of crm.meetings || []) {
    if (meeting.createdAt && inActivityPeriod(meeting.createdAt, since, until)) {
      points.push({
        at: meeting.createdAt,
        type: 'meeting',
        actorUserId: String(meeting.createdByUserId || assignee || ''),
      })
    }
  }

  for (const em of crm.emails || []) {
    if (!em.sentAt || !inActivityPeriod(em.sentAt, since, until)) continue
    if (hasEmailActivityNear(crm.activities, em.sentAt)) continue
    points.push({ at: em.sentAt, type: 'email', actorUserId: assignee })
  }

  if (entry.savedAt && inActivityPeriod(entry.savedAt, since, until)) {
    points.push({
      at: entry.savedAt,
      type: 'lead',
      actorUserId: String(entry.savedByUserId || assignee || ''),
    })
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
export function rollupPipelineActivity(entries, since, until = Infinity) {
  const org = emptyActivityRollup()
  const byUser = new Map()
  const touched = new Set()

  for (const entry of entries || []) {
    const entryId = entry.id || entry.lead?.id
    const crm = normalizeExtendedCrm(resolveEntryCrm(entry))
    const assignee = String(entry.assignedToUserId || entry.savedByUserId || entry.userId || '')

    for (const point of collectTouchpoints(entry, since, until)) {
      const bucket = bucketTouchpointType(point.type)
      incrementRollup(org, bucket)
      if (entryId) touched.add(String(entryId))

      const uid = point.actorUserId || assignee
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

/** Activity-log feed rollup — catches calls on recently touched leads. */
export function rollupFromActivityFeed(entries, since, until = Infinity, { limit = 5000 } = {}) {
  const org = emptyActivityRollup()
  const byUser = new Map()
  const touched = new Set()

  for (const act of buildActivityFeed(entries, { limit })) {
    if (!inActivityPeriod(act.createdAt, since, until)) continue
    const bucket = bucketTouchpointType(act.type)
    incrementRollup(org, bucket)
    if (act.leadId) touched.add(String(act.leadId))

    const uid = String(act.createdByUserId || act.userId || '')
    if (uid) {
      if (!byUser.has(uid)) byUser.set(uid, { ...emptyActivityRollup(), touched: new Set() })
      const row = byUser.get(uid)
      incrementRollup(row, bucket)
      if (act.leadId) row.touched.add(String(act.leadId))
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

/** Leads to scan for KPIs — matches activity log + any row touched in the period. */
export function entriesForActivityScan(allEntries, since, until = Infinity, recentLimit = 800) {
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
    const raw = resolveEntryCrm(entry)
    if (raw.lastCommunicationAt && inActivityPeriod(raw.lastCommunicationAt, since, until)) {
      add(entry)
      continue
    }
    let hit = false
    for (const act of raw.activities || []) {
      if (inActivityPeriod(act.createdAt, since, until)) {
        hit = true
        break
      }
    }
    if (hit) add(entry)
  }

  return [...byId.values()]
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
    }

    for (const meeting of raw.meetings || []) {
      if (meeting.createdAt && inActivityPeriod(meeting.createdAt, since, until)) {
        touch(String(meeting.createdByUserId || assignee || ''), entryId, 'meeting')
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

/** Best-effort rollup from activity-log window + raw CRM touchpoints. */
export function buildActivityRollup(entries, since, until = Infinity) {
  const scanSet = entriesForActivityScan(entries, since, until, 800)
  const fromFeed = rollupFromActivityFeed(scanSet, since, until)
  const fromRaw = rollupRawActivities(scanSet, since, until)
  return mergeActivityRollups(fromFeed, fromRaw)
}
