import { isSupabaseEnabled } from './supabaseClient.js'
import { emptyActivityRollup } from './crmActivityCounts.js'

const TABLE = 'pipeline_activities'

const EMAIL_TYPES = ['email', 'email_inbound']
const MEETING_TYPES = ['meeting', 'field_visit']

function cleanEnv(name) {
  const raw = process.env[name]
  if (!raw) return ''
  return String(raw).trim().replace(/^["']|["']$/g, '')
}

function baseUrl() {
  let url = cleanEnv('SUPABASE_URL')
  if (url) url = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '')
  return url
}

function serviceRoleKey() {
  return (
    cleanEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    cleanEnv('SUPABASE_SECRET_KEY') ||
    cleanEnv('SUPABASE_SERVICE_KEY')
  )
}

export function isPipelineActivitiesTableEnabled() {
  return isSupabaseEnabled()
}

function iso(ms) {
  return new Date(ms).toISOString()
}

function buildFilters(
  orgId,
  { since, until = Infinity, actorId = null, type = null, types = null, leadIds = null } = {}
) {
  const parts = [`organization_id=eq.${encodeURIComponent(orgId)}`]
  if (since != null) parts.push(`occurred_at=gte.${encodeURIComponent(iso(since))}`)
  if (until !== Infinity) parts.push(`occurred_at=lt.${encodeURIComponent(iso(until))}`)
  if (actorId) parts.push(`actor_id=eq.${encodeURIComponent(String(actorId))}`)
  if (type) parts.push(`type=eq.${encodeURIComponent(String(type))}`)
  else if (types?.length === 1) parts.push(`type=eq.${encodeURIComponent(types[0])}`)
  else if (types?.length > 1) parts.push(`type=in.(${types.map(encodeURIComponent).join(',')})`)
  if (leadIds?.length === 1) parts.push(`lead_id=eq.${encodeURIComponent(leadIds[0])}`)
  else if (leadIds?.length > 1) {
    parts.push(`lead_id=in.(${leadIds.map((id) => encodeURIComponent(String(id))).join(',')})`)
  }
  return parts
}

function sumRollups(a, b) {
  const next = { ...a }
  for (const key of Object.keys(b)) {
    if (typeof b[key] === 'number') next[key] = (Number(next[key]) || 0) + b[key]
  }
  return next
}

function chunkLeadIds(leadIds, size = 80) {
  const ids = [...new Set((leadIds || []).map(String).filter(Boolean))]
  const chunks = []
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size))
  return chunks
}

async function supabaseCount(path, { timeoutMs = 12_000 } = {}) {
  const url = `${baseUrl()}/rest/v1/${path}`
  const key = serviceRoleKey()
  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Supabase count failed (${response.status})`)
  }
  const range = response.headers.get('content-range') || ''
  const total = Number(range.split('/')[1])
  return Number.isFinite(total) ? total : 0
}

function mapRowToActivity(row, usersById = new Map()) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  const actorId = row.actor_id ? String(row.actor_id) : null
  return {
    id: payload.activityId || row.id,
    type: row.type || 'note',
    summary: row.summary || '',
    createdAt: row.occurred_at,
    createdByUserId: actorId,
    createdByName: payload.createdByName || usersById.get(actorId)?.name || null,
    userId: actorId,
    leadId: row.lead_id,
    leadName: payload.leadName || null,
    company: payload.company || null,
    meta: payload.meta || null,
  }
}

function incrementRollup(stats, type) {
  const t = String(type || '').toLowerCase()
  if (t === 'email' || t === 'email_inbound') stats.emails += 1
  else if (t === 'call') stats.calls += 1
  else if (t === 'whatsapp') stats.whatsapp += 1
  else if (t === 'meeting' || t === 'field_visit') stats.meetings += 1
  else if (t === 'task') stats.tasksCreated += 1
  else if (t === 'note') stats.notes += 1
  else if (t === 'status' || t === 'assignment' || t === 'transfer') stats.statusChanges += 1
  else if (t === 'lead') stats.newLeads += 1
  if (t && t !== 'email_bounce') stats.activitiesTotal += 1
}

async function countActivityRollupOnce(orgId, { since, until = Infinity, actorId = null, leadIds = null } = {}) {
  const base = buildFilters(orgId, { since, until, actorId, leadIds })
  const [
    total,
    calls,
    emails,
    meetings,
    notes,
    tasks,
    whatsapp,
    statusChanges,
    newLeads,
  ] = await Promise.all([
    supabaseCount(`${TABLE}?${base.join('&')}`),
    supabaseCount(`${TABLE}?${[...base, 'type=eq.call'].join('&')}`),
    supabaseCount(`${TABLE}?${buildFilters(orgId, { since, until, actorId, leadIds, types: EMAIL_TYPES }).join('&')}`),
    supabaseCount(`${TABLE}?${buildFilters(orgId, { since, until, actorId, leadIds, types: MEETING_TYPES }).join('&')}`),
    supabaseCount(`${TABLE}?${[...base, 'type=eq.note'].join('&')}`),
    supabaseCount(`${TABLE}?${[...base, 'type=eq.task'].join('&')}`),
    supabaseCount(`${TABLE}?${[...base, 'type=eq.whatsapp'].join('&')}`),
    supabaseCount(
      `${TABLE}?${buildFilters(orgId, { since, until, actorId, leadIds, types: ['status', 'assignment', 'transfer'] }).join('&')}`
    ),
    supabaseCount(`${TABLE}?${[...base, 'type=eq.lead'].join('&')}`),
  ])

  const org = {
    ...emptyActivityRollup(),
    activitiesTotal: total,
    calls,
    emails,
    meetings,
    notes,
    tasksCreated: tasks,
    whatsapp,
    statusChanges,
    newLeads,
    leadsTouched: 0,
    contactsOpened: 0,
  }

  return { org, perUser: new Map(), total }
}

/** Parallel indexed count queries — no pipeline shard load. */
export async function countActivityRollup(orgId, options = {}) {
  if (!orgId) return { org: emptyActivityRollup(), perUser: new Map(), total: 0 }
  const { leadIds, ...rest } = options
  const chunks = leadIds?.length ? chunkLeadIds(leadIds) : [null]
  let org = emptyActivityRollup()
  for (const chunk of chunks) {
    const part = await countActivityRollupOnce(orgId, {
      ...rest,
      leadIds: chunk || undefined,
    })
    org = sumRollups(org, part.org)
  }
  return { org, perUser: new Map(), total: org.activitiesTotal || 0 }
}

export async function countLeadsTouched(orgId, options = {}) {
  if (!orgId || !isPipelineActivitiesTableEnabled()) return 0
  const { leadIds, ...rest } = options
  const chunks = leadIds?.length ? chunkLeadIds(leadIds) : [null]
  const touched = new Set()
  for (const chunk of chunks) {
    const parts = [
      ...buildFilters(orgId, { ...rest, leadIds: chunk || undefined }),
      'select=lead_id',
      'limit=5000',
    ]
    const key = serviceRoleKey()
    const url = `${baseUrl()}/rest/v1/${TABLE}?${parts.join('&')}`
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) continue
    const rows = await response.json()
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      if (row?.lead_id) touched.add(String(row.lead_id))
    }
  }
  return touched.size
}

export async function listDistinctActivityActorIds(orgId, { since, until = Infinity, limit = 5000 } = {}) {
  if (!orgId || !isPipelineActivitiesTableEnabled()) return []
  try {
    const parts = [
      `organization_id=eq.${encodeURIComponent(orgId)}`,
      'actor_id=not.is.null',
      'select=actor_id',
      `limit=${Math.max(1, Math.min(10000, Number(limit) || 5000))}`,
    ]
    if (since != null) parts.push(`occurred_at=gte.${encodeURIComponent(iso(since))}`)
    if (until !== Infinity) parts.push(`occurred_at=lt.${encodeURIComponent(iso(until))}`)
    const key = serviceRoleKey()
    const url = `${baseUrl()}/rest/v1/${TABLE}?${parts.join('&')}`
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return []
    const rows = await response.json()
    if (!Array.isArray(rows)) return []
    return [...new Set(rows.map((r) => r.actor_id).filter(Boolean))]
  } catch {
    return []
  }
}

export async function orgHasPipelineActivities(orgId) {
  if (!orgId || !isPipelineActivitiesTableEnabled()) return false
  try {
    const key = serviceRoleKey()
    const url = `${baseUrl()}/rest/v1/${TABLE}?organization_id=eq.${encodeURIComponent(orgId)}&select=id&limit=1`
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return false
    const rows = await response.json()
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

/** Newest indexed activity timestamp for an org (no period filter). */
export async function newestPipelineActivityMs(orgId) {
  if (!orgId || !isPipelineActivitiesTableEnabled()) return 0
  try {
    const feed = await listPipelineActivities(orgId, {
      limit: 1,
      offset: 0,
      usersById: new Map(),
    })
    if (!feed.rows?.length) return 0
    const t = new Date(feed.rows[0].createdAt || 0).getTime()
    return Number.isFinite(t) ? t : 0
  } catch {
    return 0
  }
}

/** Paginated activity feed — default LIMIT 50, indexed occurred_at DESC. */
export async function listPipelineActivities(
  orgId,
  {
    since,
    until = Infinity,
    actorId = null,
    type = null,
    leadIds = null,
    limit = 50,
    offset = 0,
    usersById = new Map(),
  } = {}
) {
  if (!orgId || !isPipelineActivitiesTableEnabled()) {
    return { rows: [], total: 0 }
  }

  if (Array.isArray(leadIds) && leadIds.length === 0) {
    return { rows: [], total: 0 }
  }

  const parts = [
    ...buildFilters(orgId, { since, until, actorId, type, leadIds }),
    'select=id,lead_id,actor_id,type,summary,occurred_at,payload',
    'order=occurred_at.desc',
    `limit=${Math.max(1, Math.min(200, Number(limit) || 50))}`,
  ]
  if (offset > 0) parts.push(`offset=${Math.max(0, Number(offset) || 0)}`)

  const key = serviceRoleKey()
  const path = `${TABLE}?${parts.join('&')}`
  const url = `${baseUrl()}/rest/v1/${path}`

  const [total, response] = await Promise.all([
    supabaseCount(`${TABLE}?${buildFilters(orgId, { since, until, actorId, type, leadIds }).join('&')}`),
    fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    }),
  ])

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Supabase list failed (${response.status})`)
  }

  const data = await response.json()
  const rows = Array.isArray(data) ? data.map((row) => mapRowToActivity(row, usersById)) : []
  return { rows, total }
}

export async function insertPipelineActivity({
  organizationId,
  leadId,
  actorId,
  type,
  summary,
  occurredAt,
  payload = {},
}) {
  if (!organizationId || !leadId || !isPipelineActivitiesTableEnabled()) return null

  const key = serviceRoleKey()
  const url = `${baseUrl()}/rest/v1/${TABLE}`
  const body = {
    organization_id: String(organizationId),
    lead_id: String(leadId),
    actor_id: actorId ? String(actorId) : null,
    type: String(type || 'note'),
    summary: String(summary || '').slice(0, 500),
    occurred_at: occurredAt || new Date().toISOString(),
    payload,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `pipeline_activities insert failed (${response.status})`)
  }

  return true
}

export function rollupFromActivityRows(rows = []) {
  const stats = emptyActivityRollup()
  const touched = new Set()
  for (const row of rows) {
    incrementRollup(stats, row.type)
    if (row.leadId) touched.add(String(row.leadId))
  }
  stats.leadsTouched = touched.size
  stats.contactsOpened = touched.size
  return stats
}
