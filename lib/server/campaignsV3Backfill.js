import { readStore } from './store.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import {
  buildCampaignRecipientRow,
  buildCampaignV3Row,
  campaignsV3TableActive,
  upsertCampaignRecipients,
  upsertCampaignStatsRow,
  upsertCampaignV3,
} from './campaignsV3Table.js'
import { readCampaignEnrollments } from './marketingEnrollmentShard.js'
import { readCampaignStatsShard } from './marketingCampaignStatsShard.js'
import { loadPipelineStoreForLeadIds } from './pipelineShard.js'

const CAMPAIGNS_TABLE = 'campaigns_v3'
const RECIPIENTS_TABLE = 'campaign_recipients'

function orgRepUser(store, orgId) {
  const users = (store.users || []).filter((u) => u.organizationId === orgId)
  return users.find((u) => u.isOrgAdmin || u.orgRole === 'org_admin') || users[0] || null
}

function campaignsForOrg(store, orgId) {
  const userIds = new Set(
    (store.users || []).filter((u) => u.organizationId === orgId).map((u) => u.id)
  )
  return (store.marketingCampaigns || []).filter(
    (c) => c.organizationId === orgId || (!c.organizationId && userIds.has(c.createdByUserId))
  )
}

function leadForEnrollment(store, enrollment) {
  if (!enrollment?.leadId) return null
  const entry = (store.savedLeads || []).find(
    (e) => (e.lead?.id || e.id) === enrollment.leadId
  )
  return entry?.lead || entry || null
}

async function backfillCampaign(campaign, user, store, { dryRun = false } = {}) {
  const row = buildCampaignV3Row(campaign, user)
  if (!row) return { campaignId: campaign.id, skipped: true, reason: 'no_org' }

  const enrollments = await readCampaignEnrollments(campaign.id)
  const withEmail = enrollments.filter((e) =>
    String(e.contactEmail || '').includes('@')
  )

  let pipelineStore = store
  const leadIds = [...new Set(withEmail.map((e) => e.leadId).filter(Boolean))]
  if (leadIds.length && user) {
    try {
      const { pipelineStore: loaded } = await loadPipelineStoreForLeadIds(user, leadIds)
      pipelineStore = { ...store, savedLeads: loaded.savedLeads || [] }
    } catch {
      pipelineStore = store
    }
  }

  const recipientRows = []
  for (const enrollment of withEmail) {
    const lead = leadForEnrollment(pipelineStore, enrollment)
    const built = buildCampaignRecipientRow(campaign, enrollment, lead)
    if (built) recipientRows.push(built)
  }

  const shard = await readCampaignStatsShard(campaign.id)
  const stats = { ...(campaign.stats || {}), ...(shard || {}) }

  if (dryRun) {
    return {
      campaignId: campaign.id,
      campaigns: 1,
      recipients: recipientRows.length,
      enrollments: withEmail.length,
    }
  }

  await upsertCampaignV3(row)
  let recipientsUpserted = 0
  if (recipientRows.length) {
    const part = await upsertCampaignRecipients(recipientRows)
    recipientsUpserted = part.upserted || 0
  }
  await upsertCampaignStatsRow(campaign.id, {
    queued: stats.enrolled ?? recipientRows.length,
    sent: stats.sent || 0,
    failed: stats.failed || 0,
    unsubscribed: stats.unsubscribed || 0,
  })

  return {
    campaignId: campaign.id,
    campaigns: 1,
    recipients: recipientsUpserted,
    enrollments: withEmail.length,
  }
}

export async function backfillCampaignsV3ForOrg(orgId, options = {}) {
  if (!isSupabaseEnabled()) throw new Error('Supabase is not configured')
  if (!campaignsV3TableActive()) throw new Error('campaigns_v3 table path disabled')
  if (!orgId) throw new Error('orgId is required')

  const store = await readStore({ only: ['marketingCampaigns', 'users', 'organizations'] })
  const user = orgRepUser(store, orgId)
  const campaigns = campaignsForOrg(store, orgId)
  const started = Date.now()
  const results = []

  for (const campaign of campaigns) {
    results.push(await backfillCampaign(campaign, user, store, options))
  }

  return {
    organizationId: orgId,
    campaignCount: campaigns.length,
    results,
    durationMs: Date.now() - started,
  }
}

export async function backfillAllCampaignsV3(options = {}) {
  const store = await readStore({ only: ['organizations'] })
  const orgs = options.orgId
    ? (store.organizations || []).filter((o) => o.id === options.orgId)
    : store.organizations || []

  const results = []
  for (const org of orgs) {
    if (!org?.id) continue
    results.push(await backfillCampaignsV3ForOrg(org.id, options))
  }
  return results
}

export async function verifyCampaignsV3Backfill({ orgId = null } = {}) {
  const store = await readStore({ only: ['marketingCampaigns', 'users', 'organizations'] })
  const orgs = orgId
    ? (store.organizations || []).filter((o) => o.id === orgId)
    : store.organizations || []

  const checks = []
  for (const org of orgs) {
    if (!org?.id) continue
    const campaigns = campaignsForOrg(store, org.id)
    let shardRecipientCount = 0
    let sqlRecipientCount = 0
    let sqlCampaignCount = 0

    try {
      for (const campaign of campaigns) {
        const enrollments = await readCampaignEnrollments(campaign.id)
        shardRecipientCount += enrollments.filter((e) =>
          String(e.contactEmail || '').includes('@')
        ).length
      }
    } catch (error) {
      checks.push({ organizationId: org.id, ok: false, error: error?.message || String(error) })
      continue
    }

    try {
      const campaignRows = await supabaseRest(
        `${CAMPAIGNS_TABLE}?organization_id=eq.${encodeURIComponent(org.id)}&select=id`,
        {},
        { timeoutMs: 30_000 }
      )
      sqlCampaignCount = Array.isArray(campaignRows) ? campaignRows.length : 0

      const ids = campaigns.map((c) => c.id).filter(Boolean)
      if (ids.length) {
        const recipientRows = await supabaseRest(
          `${RECIPIENTS_TABLE}?campaign_id=in.(${ids.map(encodeURIComponent).join(',')})&select=id`,
          {},
          { timeoutMs: 60_000 }
        )
        sqlRecipientCount = Array.isArray(recipientRows) ? recipientRows.length : 0
      }
    } catch (error) {
      checks.push({ organizationId: org.id, ok: false, error: error?.message || String(error) })
      continue
    }

    checks.push({
      organizationId: org.id,
      ok: sqlCampaignCount >= campaigns.length && sqlRecipientCount >= shardRecipientCount,
      campaignCount: campaigns.length,
      sqlCampaignCount,
      shardRecipientCount,
      sqlRecipientCount,
    })
  }

  const ok = checks.every((c) => c.ok)
  return { ok: checks.length === 0 ? true : ok, checks }
}
