import { isPipelineLeadsTableEnabled } from './infra/config.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'

const TABLE = 'pipeline_meetings'

export function pipelineMeetingsTableActive() {
  return isPipelineLeadsTableEnabled() && isSupabaseEnabled()
}

function leadMeta(entry) {
  const lead = entry?.lead || entry
  const leadId = lead?.id || entry?.id
  const leadName =
    [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.company || 'Lead'
  return {
    leadId: leadId ? String(leadId) : null,
    leadName,
    company: lead?.company || '',
  }
}

function meetingEndsAt(meeting) {
  if (!meeting?.scheduledAt) return null
  const start = new Date(meeting.scheduledAt).getTime()
  if (!Number.isFinite(start)) return null
  const mins = Number(meeting.durationMinutes) || 30
  return new Date(start + mins * 60_000).toISOString()
}

export function buildPipelineMeetingRow(organizationId, entry, meeting) {
  if (!organizationId || !meeting?.id) return null
  const { leadId, leadName, company } = leadMeta(entry)
  if (!leadId) return null

  const ownerId =
    meeting.assignedToUserId ||
    entry.assignedToUserId ||
    entry.savedByUserId ||
    entry.userId ||
    null

  return {
    organization_id: String(organizationId),
    lead_id: leadId,
    meeting_id: String(meeting.id),
    owner_id: ownerId ? String(ownerId) : null,
    starts_at: meeting.scheduledAt || null,
    ends_at: meetingEndsAt(meeting),
    payload: { meeting, leadName, company },
    updated_at: meeting.scheduledAt || meeting.createdAt || new Date().toISOString(),
  }
}

export async function upsertPipelineMeetings(rows) {
  if (!pipelineMeetingsTableActive() || !rows?.length) return { upserted: 0 }

  const chunkSize = 40
  let upserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await supabaseRest(
      `${TABLE}?on_conflict=organization_id,meeting_id`,
      {
        method: 'POST',
        headers: { Prefer: 'return=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk),
      },
      { timeoutMs: 60_000 }
    )
    upserted += chunk.length
  }
  return { upserted }
}

export async function deletePipelineMeetingsNotInSet(organizationId, leadId, meetingIds) {
  if (!pipelineMeetingsTableActive() || !organizationId || !leadId) return

  const keep = new Set((meetingIds || []).map(String))
  const existing = await supabaseRest(
    `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&lead_id=eq.${encodeURIComponent(leadId)}&select=meeting_id`,
    {},
    { timeoutMs: 20_000 }
  )
  if (!Array.isArray(existing)) return

  for (const row of existing) {
    const meetingId = row?.meeting_id
    if (!meetingId || keep.has(String(meetingId))) continue
    await supabaseRest(
      `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}` +
        `&meeting_id=eq.${encodeURIComponent(meetingId)}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      { timeoutMs: 15_000 }
    )
  }
}

export async function syncPipelineMeetingsForEntry({ organizationId, entry }) {
  if (!pipelineMeetingsTableActive() || !organizationId || !entry) return { synced: 0 }

  const meetings = Array.isArray(entry.crm?.meetings) ? entry.crm.meetings : []
  const rows = meetings
    .map((meeting) => buildPipelineMeetingRow(organizationId, entry, meeting))
    .filter(Boolean)

  const { leadId } = leadMeta(entry)
  if (leadId) {
    await deletePipelineMeetingsNotInSet(
      organizationId,
      leadId,
      meetings.map((m) => m.id)
    )
  }
  const result = await upsertPipelineMeetings(rows)
  return { synced: result.upserted || 0 }
}

export async function orgHasPipelineMeetings(organizationId) {
  if (!organizationId || !pipelineMeetingsTableActive()) return false
  try {
    const rows = await supabaseRest(
      `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}&select=meeting_id&limit=1`,
      {},
      { timeoutMs: 10_000, attempts: 1 }
    )
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

/** Meetings from SQL for My Day (today window). */
export async function listPipelineMeetingsForMyDay(
  organizationId,
  ownerId,
  { startsAfterIso, startsBeforeIso, limit = 40 } = {}
) {
  if (!pipelineMeetingsTableActive() || !organizationId || !ownerId) return []

  const lim = Math.min(100, Math.max(1, Number(limit) || 40))
  const parts = [
    `organization_id=eq.${encodeURIComponent(organizationId)}`,
    `owner_id=eq.${encodeURIComponent(ownerId)}`,
  ]
  if (startsAfterIso) parts.push(`starts_at=gte.${encodeURIComponent(startsAfterIso)}`)
  if (startsBeforeIso) parts.push(`starts_at=lte.${encodeURIComponent(startsBeforeIso)}`)

  const path =
    `${TABLE}?${parts.join('&')}` +
    `&select=lead_id,meeting_id,starts_at,ends_at,payload,updated_at` +
    `&order=starts_at.asc&limit=${lim}`

  const rows = await supabaseRest(path, {}, { timeoutMs: 20_000 })
  if (!Array.isArray(rows)) return []
  return rows
}
