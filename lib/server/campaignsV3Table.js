import { isCampaignsV3TableEnabled } from './infra/config.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'

const CAMPAIGNS_TABLE = 'campaigns_v3'
const RECIPIENTS_TABLE = 'campaign_recipients'
const STATS_TABLE = 'campaign_stats'
const EVENTS_TABLE = 'campaign_events'

export function campaignsV3TableActive() {
  return isCampaignsV3TableEnabled() && isSupabaseEnabled()
}

function orgIdFromUser(user) {
  return user?.organizationId ? String(user.organizationId) : null
}

export function buildCampaignV3Row(campaign, user) {
  if (!campaign?.id) return null
  const organizationId = campaign.organizationId || orgIdFromUser(user)
  if (!organizationId) return null

  return {
    id: String(campaign.id),
    organization_id: organizationId,
    name: String(campaign.name || 'Campaign').slice(0, 300),
    channel: String(campaign.channel || 'email').slice(0, 40),
    status: String(campaign.status || 'draft').slice(0, 40),
    send_status: String(campaign.sendStatus || campaign.stats?.sendStatus || 'draft').slice(0, 40),
    provider: campaign.emailProvider ? String(campaign.emailProvider).slice(0, 40) : null,
    source: campaign.source ? String(campaign.source).slice(0, 64) : null,
    scheduled_at: campaign.scheduledAt || null,
    started_at: campaign.startedAt || null,
    completed_at: campaign.completedAt || null,
    total_recipients: Number(campaign.stats?.enrolled ?? campaign.totalRecipients ?? 0) || 0,
    correlation_id: campaign.correlationId ? String(campaign.correlationId).slice(0, 80) : null,
    created_by: campaign.createdByUserId || campaign.userId || user?.id || null,
    stats: campaign.stats && typeof campaign.stats === 'object' ? campaign.stats : {},
    updated_at: campaign.updatedAt || new Date().toISOString(),
  }
}

export function buildCampaignRecipientRow(campaign, enrollment, lead = null) {
  if (!campaign?.id || !enrollment?.id) return null
  const email = String(enrollment.contactEmail || lead?.email || '').trim().toLowerCase()
  if (!email.includes('@')) return null

  const leadSnapshot = lead
    ? {
        id: lead.id || enrollment.leadId,
        email: lead.email || email,
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        company: lead.company || '',
        name:
          lead.name ||
          [lead.firstName, lead.lastName].filter(Boolean).join(' ') ||
          lead.company ||
          email,
      }
    : {
        id: enrollment.leadId,
        email,
        firstName: '',
        lastName: '',
        company: '',
        name: email,
      }

  return {
    campaign_id: String(campaign.id),
    lead_id: enrollment.leadId ? String(enrollment.leadId) : null,
    email,
    status: enrollment.status === 'active' ? 'queued' : String(enrollment.status || 'queued'),
    next_send_at: enrollment.nextSendAt || new Date().toISOString(),
    enrollment_ref: String(enrollment.id),
    payload: {
      enrollmentId: enrollment.id,
      contactPhone: enrollment.contactPhone || null,
      currentStep: enrollment.currentStep ?? 0,
      abVariantId: enrollment.abVariantId || null,
      chunkIndex: enrollment.chunkIndex ?? 0,
      leadSnapshot,
      leadName:
        [leadSnapshot.firstName, leadSnapshot.lastName].filter(Boolean).join(' ') ||
        leadSnapshot.company ||
        email,
    },
    updated_at: enrollment.updatedAt || new Date().toISOString(),
  }
}

export function enrollmentFromRecipientRow(row) {
  if (!row) return null
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  const status =
    row.status === 'queued' || row.status === 'sending' ? 'active' : row.status || 'active'
  return {
    id: row.enrollment_ref || payload.enrollmentId || row.id,
    sqlRecipientId: row.id,
    campaignId: row.campaign_id,
    leadId: row.lead_id,
    contactEmail: row.email,
    contactPhone: payload.contactPhone || null,
    currentStep: payload.currentStep ?? 0,
    nextSendAt: row.next_send_at,
    status,
    abVariantId: payload.abVariantId || null,
    chunkIndex: payload.chunkIndex ?? 0,
    sentCount: payload.sentCount || 0,
    lastSentAt: payload.lastSentAt || null,
    lastError: payload.lastError || null,
    updatedAt: row.updated_at,
    payload,
  }
}

export function leadFromRecipientEnrollment(enrollment) {
  const payload = enrollment?.payload || {}
  if (payload.leadSnapshot && typeof payload.leadSnapshot === 'object') {
    return payload.leadSnapshot
  }
  const email = String(enrollment?.contactEmail || enrollment?.email || '').trim()
  return {
    id: enrollment?.leadId || enrollment?.lead_id,
    email,
    firstName: payload.firstName || '',
    lastName: payload.lastName || '',
    company: payload.company || '',
    name: payload.leadName || email,
  }
}

export function leadFromRecipientRow(row) {
  return leadFromRecipientEnrollment(enrollmentFromRecipientRow(row))
}

export async function upsertCampaignV3(row) {
  if (!campaignsV3TableActive() || !row) return { upserted: 0 }
  await supabaseRest(`${CAMPAIGNS_TABLE}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  })
  return { upserted: 1 }
}

export async function upsertCampaignRecipients(rows) {
  if (!campaignsV3TableActive() || !rows?.length) return { upserted: 0 }
  const chunkSize = 50
  let upserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await supabaseRest(
      `${RECIPIENTS_TABLE}?on_conflict=campaign_id,enrollment_ref`,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk),
      },
      { timeoutMs: 90_000 }
    )
    upserted += chunk.length
  }
  return { upserted }
}

export async function readDueCampaignRecipients(campaignId, limit = 12) {
  if (!campaignsV3TableActive() || !campaignId) return []
  const lim = Math.min(50, Math.max(1, Number(limit) || 12))
  const now = new Date().toISOString()
  const rows = await supabaseRest(
    `${RECIPIENTS_TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}` +
      `&status=in.(queued,active,sending)` +
      `&next_send_at=lte.${encodeURIComponent(now)}` +
      `&select=id,campaign_id,lead_id,email,status,next_send_at,enrollment_ref,payload,updated_at` +
      `&order=next_send_at.asc&limit=${lim}`,
    {},
    { timeoutMs: 30_000 }
  )
  if (!Array.isArray(rows)) return []
  return rows.map(enrollmentFromRecipientRow).filter(Boolean)
}

export async function readCampaignRecipientsFromSql(campaignId) {
  if (!campaignsV3TableActive() || !campaignId) return []
  const rows = await supabaseRest(
    `${RECIPIENTS_TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}` +
      `&select=id,campaign_id,lead_id,email,status,next_send_at,enrollment_ref,payload,updated_at` +
      `&order=next_send_at.asc&limit=5000`,
    {},
    { timeoutMs: 60_000 }
  )
  if (!Array.isArray(rows)) return []
  return rows.map(enrollmentFromRecipientRow).filter(Boolean)
}

export async function patchCampaignRecipientByEnrollmentRef(campaignId, enrollmentRef, patch) {
  if (!campaignsV3TableActive() || !campaignId || !enrollmentRef) return
  const body = { updated_at: new Date().toISOString() }
  if (patch.status != null) body.status = patch.status
  if (patch.next_send_at != null) body.next_send_at = patch.next_send_at
  if (patch.payload != null) body.payload = patch.payload

  await supabaseRest(
    `${RECIPIENTS_TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}` +
      `&enrollment_ref=eq.${encodeURIComponent(enrollmentRef)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    },
    { timeoutMs: 20_000 }
  )
}

export async function upsertCampaignStatsRow(campaignId, patch = {}) {
  if (!campaignsV3TableActive() || !campaignId) return
  const prev = await supabaseRest(
    `${STATS_TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}&select=*&limit=1`,
    {},
    { timeoutMs: 15_000 }
  )
  const base = Array.isArray(prev) && prev[0] ? prev[0] : { campaign_id: campaignId }

  const row = {
    campaign_id: campaignId,
    queued: patch.queued != null ? patch.queued : base.queued || 0,
    sending: patch.sending != null ? patch.sending : base.sending || 0,
    sent: patch.sent != null ? patch.sent : base.sent || 0,
    delivered: patch.delivered != null ? patch.delivered : base.delivered || 0,
    opened: patch.opened != null ? patch.opened : base.opened || 0,
    clicked: patch.clicked != null ? patch.clicked : base.clicked || 0,
    bounced: patch.bounced != null ? patch.bounced : base.bounced || 0,
    failed: patch.failed != null ? patch.failed : base.failed || 0,
    unsubscribed: patch.unsubscribed != null ? patch.unsubscribed : base.unsubscribed || 0,
    updated_at: new Date().toISOString(),
  }

  if (patch._delta) {
    for (const [key, val] of Object.entries(patch._delta)) {
      if (row[key] != null && typeof val === 'number') row[key] = (row[key] || 0) + val
    }
  }

  await supabaseRest(`${STATS_TABLE}?on_conflict=campaign_id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  })
}

export async function insertCampaignEvent({ campaignId, recipientId, eventType, metadata = {} }) {
  if (!campaignsV3TableActive() || !campaignId || !eventType) return
  await supabaseRest(EVENTS_TABLE, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      campaign_id: campaignId,
      recipient_id: recipientId || null,
      event_type: String(eventType).slice(0, 80),
      metadata,
      occurred_at: new Date().toISOString(),
    }),
  })
}

export async function patchCampaignV3Fields(campaignId, patch) {
  if (!campaignsV3TableActive() || !campaignId || !patch) return
  await supabaseRest(
    `${CAMPAIGNS_TABLE}?id=eq.${encodeURIComponent(campaignId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    },
    { timeoutMs: 15_000 }
  )
}

export async function orgHasCampaignRecipients(campaignId) {
  if (!campaignId || !campaignsV3TableActive()) return false
  try {
    const rows = await supabaseRest(
      `${RECIPIENTS_TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}&select=id&limit=1`,
      {},
      { timeoutMs: 10_000, attempts: 1 }
    )
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

export async function countSqlCampaignRecipients(campaignId, { activeOnly = true } = {}) {
  if (!campaignsV3TableActive() || !campaignId) return 0
  let path =
    `${RECIPIENTS_TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}&select=id`
  if (activeOnly) path += `&status=in.(queued,active,sending)`
  const rows = await supabaseRest(path, {}, { timeoutMs: 20_000 })
  return Array.isArray(rows) ? rows.length : 0
}

export async function countDueCampaignRecipients(campaignId) {
  if (!campaignsV3TableActive() || !campaignId) return 0
  const now = new Date().toISOString()
  const rows = await supabaseRest(
    `${RECIPIENTS_TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}` +
      `&status=in.(queued,active,sending)` +
      `&next_send_at=lte.${encodeURIComponent(now)}&select=id`,
    {},
    { timeoutMs: 20_000 }
  )
  return Array.isArray(rows) ? rows.length : 0
}

/** Aggregated send progress from campaign_stats + campaigns_v3 (Deploy 13). */
export async function readCampaignProgressAggregate(campaignId) {
  if (!campaignsV3TableActive() || !campaignId) return null
  try {
    const [statsRows, campaignRows, dueCount, activeCount] = await Promise.all([
      supabaseRest(
        `${STATS_TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}&select=*&limit=1`,
        {},
        { timeoutMs: 15_000, attempts: 1 }
      ),
      supabaseRest(
        `${CAMPAIGNS_TABLE}?id=eq.${encodeURIComponent(campaignId)}` +
          `&select=send_status,status,provider&limit=1`,
        {},
        { timeoutMs: 15_000, attempts: 1 }
      ),
      countDueCampaignRecipients(campaignId),
      countSqlCampaignRecipients(campaignId, { activeOnly: true }),
    ])

    const stats = Array.isArray(statsRows) && statsRows[0] ? statsRows[0] : null
    const campaign = Array.isArray(campaignRows) && campaignRows[0] ? campaignRows[0] : null
    if (!stats && !campaign) return null

    return {
      stats,
      campaign,
      dueCount,
      activeCount,
    }
  } catch {
    return null
  }
}
