import { createId, readStore, updateStore, updateStorePartial } from './store.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { buildOrgUserResponse, listPipelineSavedEntries } from './organizations.js'
import {
  canAccessMarketingAsset,
  canManageMarketingCampaign,
  canViewMarketingCampaign,
  enrichMarketingRows,
  filterMarketingAssets,
  filterMarketingCampaignsVisible,
  filterMarketingRows,
  marketingScopeKey,
} from './marketingAccess.js'
import {
  buildCampaignAnalyticsFromStats,
  marketingSummary,
  summarizeEnrollmentEngagement,
} from './marketingAnalytics.js'
import {
  bumpCampaignStatsShard,
  mergeCampaignStatsShards,
  writeCampaignStatsShard,
} from './marketingCampaignStatsShard.js'
import {
  ENROLLMENT_CHUNK_SIZE,
  countPendingCampaignEnrollments,
  patchCampaignEnrollments,
  readCampaignEnrollments,
  readDueCampaignEnrollments,
  writeCampaignEnrollments,
} from './marketingEnrollmentShard.js'
import {
  filterMarketingEvents,
  filterMarketingEventsForCampaign,
} from './marketingEvents.js'
import { sendMarketingMessage } from './marketingSend.js'
import { isEmailSuppressed } from './marketingUnsubscribe.js'
import { filterLeadIdsForMarketingChannel, normalizeMarketingChannel } from './marketingLeadEligibility.js'
import {
  buildEnrollmentWhatsAppPayload,
  listEligibleWhatsAppLeads,
  refreshWhatsAppEnrollmentMessages,
  sendWhatsAppCampaignEnrollment,
} from './marketingWhatsApp.js'
import { isWhatsAppCloudConfigured } from './whatsappCloud.js'
import { loadPipelineStoreContext } from './pipelineShard.js'

export const MAX_LIST_LEADS = 200
export const MAX_SEQUENCE_STEPS = 5
/** One email per serverless invocation (Hobby ~10s limit; Gmail is slow). */
export const MARKETING_SEND_CHUNK = 1

export function resolveCampaignSender(store, campaign) {
  if (!campaign) return null
  let raw = campaign.createdByUserId
    ? (store.users || []).find((u) => u.id === campaign.createdByUserId)
    : null
  if (!raw && campaign.organizationId) {
    const org = (store.organizations || []).find((o) => o.id === campaign.organizationId)
    if (org?.ownerUserId) {
      raw = (store.users || []).find((u) => u.id === org.ownerUserId)
    }
  }
  if (!raw) return null
  return buildOrgUserResponse(raw, store)
}

export async function countPendingCampaignSends(campaignId) {
  return countPendingCampaignEnrollments(campaignId)
}

export function normalizeCampaignSteps(steps, fallbackSubject, fallbackBody) {
  const list = Array.isArray(steps) ? steps : []
  if (!list.length) {
    return [
      {
        stepIndex: 0,
        subject: String(fallbackSubject || '').trim(),
        body: String(fallbackBody || '').trim(),
        delayDays: 0,
      },
    ]
  }
  return list.slice(0, MAX_SEQUENCE_STEPS).map((step, index) => ({
    stepIndex: index,
    subject: String(step.subject ?? fallbackSubject ?? '').trim(),
    body: String(step.body ?? fallbackBody ?? '').trim(),
    blocks: Array.isArray(step.blocks) ? step.blocks : undefined,
    design: step.design && typeof step.design === 'object' ? step.design : undefined,
    previewText: step.previewText ? String(step.previewText).slice(0, 240) : undefined,
    delayDays: Math.max(0, Math.min(30, Number(step.delayDays) || (index === 0 ? 0 : 3))),
  }))
}

export function getMarketingList(store, user, listId) {
  const row = (store.marketingLists || []).find((l) => l.id === listId)
  if (!row || !canAccessMarketingAsset(row, user)) return null
  return row
}

export function getMarketingTemplate(store, user, templateId) {
  if (!templateId) return null
  const row = (store.marketingTemplates || []).find((t) => t.id === templateId)
  if (!row || !canAccessMarketingAsset(row, user)) return null
  return row
}

export function getMarketingCampaign(store, user, campaignId, { manage = false } = {}) {
  const row = (store.marketingCampaigns || []).find((c) => c.id === campaignId)
  if (!row) return null
  if (manage) {
    if (!canManageMarketingCampaign(row, user)) return null
  } else if (!canViewMarketingCampaign(row, user)) {
    return null
  }
  return row
}

/** Stop sends, pause enrollments, move campaign to archive (reports folder). */
export async function archiveMarketingCampaign(user, campaignId) {
  const meta = await readStore({ only: ['marketingCampaigns'] })
  const campaign = getMarketingCampaign(meta, user, campaignId, { manage: true })
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.status === 'archived') return campaign

  const rows = await readCampaignEnrollments(campaignId)
  const now = new Date().toISOString()
  if (rows.some((e) => e.status === 'active')) {
    const next = rows.map((e) =>
      e.status === 'active'
        ? { ...e, status: 'paused', nextSendAt: null, updatedAt: now }
        : e
    )
    await writeCampaignEnrollments(campaignId, next)
  }

  await updateStorePartial(['marketingCampaigns'], (draft) => {
    const row = (draft.marketingCampaigns || []).find((c) => c.id === campaignId)
    if (row) {
      row.status = 'archived'
      row.archivedAt = now
      row.updatedAt = now
    }
    return draft
  })
  await bumpCampaignStatsShard(campaignId, { status: 'archived' })

  const updated = await readStore({ only: ['marketingCampaigns'] })
  return getMarketingCampaign(updated, user, campaignId)
}

export function resolveCampaignContent(campaign, template) {
  const subject = campaign.subject?.trim() || template?.subject || ''
  const body = campaign.body?.trim() || template?.body || ''
  const blocks = campaign.blocks?.length ? campaign.blocks : template?.blocks
  const design = campaign.design || template?.design
  const previewText = campaign.previewText || template?.previewText
  const steps = normalizeCampaignSteps(campaign.steps, subject, body).map((step, index) => {
    const raw = Array.isArray(campaign.steps) ? campaign.steps[index] : null
    if (raw?.blocks?.length) {
      return {
        ...step,
        blocks: raw.blocks,
        design: raw.design || design,
        previewText: raw.previewText || (index === 0 ? previewText : undefined),
      }
    }
    if (index === 0 && blocks?.length) return { ...step, blocks, design, previewText }
    return step
  })
  return { subject, body, blocks, design, previewText, steps }
}

export function listEligibleLeads(store, user, leadIds) {
  const unique = [...new Set(leadIds || [])]
  const pipelineByLeadId = new Map(
    listPipelineSavedEntries(store, user)
      .filter((e) => e.lead?.id)
      .map((e) => [e.lead.id, e])
  )
  const scope = user.organizationId
    ? { organizationId: user.organizationId, createdByUserId: null }
    : { organizationId: null, createdByUserId: user.id }
  const eligible = []
  for (const leadId of unique) {
    const entry = pipelineByLeadId.get(leadId)
    if (!entry) continue
    const lead = entry.lead || entry
    const email = String(lead.email || '').trim().toLowerCase()
    if (!email.includes('@')) continue
    if (isEmailSuppressed(store, { ...scope, email })) continue
    eligible.push({ leadId, lead, email, entry })
  }
  return eligible
}

function addDaysIso(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

export async function enrollCampaign(store, user, campaign, list) {
  const channel = normalizeMarketingChannel(campaign.channel || list.channel || 'email')
  const template = getMarketingTemplate(store, user, campaign.templateId)
  const { steps } = resolveCampaignContent(campaign, template)
  const scope = marketingScopeKey(user)
  const now = new Date().toISOString()

  const listLeadIds = filterLeadIdsForMarketingChannel(store, user, list.leadIds, channel)
  const eligible =
    channel === 'whatsapp'
      ? listEligibleWhatsAppLeads(store, user, listLeadIds)
      : listEligibleLeads(store, user, listLeadIds)

  const enrollments = eligible.map((row, index) => {
    const leadId = row.leadId
    const entry = row.entry || findPipelineEntry(store, user, leadId)
    const lead = row.lead || entry?.lead || entry
    const step = steps[0]
    const wa =
      channel === 'whatsapp' && lead && step
        ? buildEnrollmentWhatsAppPayload(store, user, campaign, template, { leadId, contactPhone: row.phone }, step)
        : null
    return {
      id: createId('menroll'),
      ...scope,
      campaignId: campaign.id,
      leadId,
      contactEmail: row.email || lead?.email || null,
      contactPhone: row.phone || null,
      currentStep: 0,
      nextSendAt: now,
      status: 'active',
      sentCount: 0,
      lastSentAt: null,
      lastError: null,
      whatsappMessage: wa?.message || null,
      whatsappUrl: wa?.url || null,
      chunkIndex: Math.floor(index / ENROLLMENT_CHUNK_SIZE),
      createdAt: now,
      updatedAt: now,
    }
  })

  await writeCampaignEnrollments(campaign.id, enrollments)

  await writeCampaignStatsShard(campaign.id, {
    status: 'active',
    enrolled: enrollments.length,
    sent: campaign.stats?.sent || 0,
    failed: campaign.stats?.failed || 0,
    unsubscribed: campaign.stats?.unsubscribed || 0,
    steps: steps.length,
  })

  return enrollments.length
}

const MARKETING_STORE_SLICES = [
  'marketingCampaigns',
  'marketingEnrollments',
  'marketingTemplates',
  'marketingLists',
  'marketingSuppressions',
  'users',
  'organizations',
  'organizationMemberships',
  'savedLeads',
]

const MARKETING_META_SLICES = MARKETING_STORE_SLICES.filter(
  (c) => c !== 'savedLeads' && c !== 'marketingEnrollments'
)

/** Minimal store read for sending — campaign body comes from mcamp_{id} shard. */
export const MARKETING_SEND_META_SLICES = [
  'marketingSuppressions',
  'users',
  'organizations',
  'organizationMemberships',
]

/** @deprecated use MARKETING_SEND_META_SLICES + readCampaignSendShard */
export const MARKETING_SEND_READ_SLICES = [
  ...MARKETING_SEND_META_SLICES,
  'marketingCampaigns',
  'marketingTemplates',
]

function leadForEnrollment(store, user, enrollment) {
  const entry = (store.savedLeads || []).length
    ? findPipelineEntry(store, user, enrollment.leadId)
    : null
  if (entry) return entry.lead || entry
  const email = String(enrollment.contactEmail || '').trim().toLowerCase()
  if (!email.includes('@')) return null
  return {
    id: enrollment.leadId,
    email,
    firstName: '',
    lastName: '',
    company: '',
    name: email,
  }
}

function applyCampaignCompletionForCampaign(campaign, enrollments) {
  if (!campaign || campaign.status !== 'active') return
  if (!enrollments?.length) return
  const pending = enrollments.some((e) => e.status === 'active')
  if (!pending) {
    campaign.status = 'completed'
    campaign.completedAt = new Date().toISOString()
    campaign.updatedAt = campaign.completedAt
  }
}

async function syncCampaignStatsAfterSends(campaignId, pendingWrites) {
  const delta = { sent: 0, failed: 0, unsubscribed: 0 }
  for (const write of pendingWrites) {
    if (write.kind === 'failed') delta.failed += 1
    else if (write.kind === 'unsubscribed') delta.unsubscribed += 1
    else if (write.kind === 'sent') delta.sent += 1
  }
  if (delta.sent || delta.failed || delta.unsubscribed) {
    await bumpCampaignStatsShard(campaignId, delta)
  }

  const { campaignHasActiveEnrollments } = await import('./marketingEnrollmentShard.js')
  if (!(await campaignHasActiveEnrollments(campaignId))) {
    const completedAt = new Date().toISOString()
    await bumpCampaignStatsShard(campaignId, { status: 'completed', completedAt })
  }
}

async function hydrateStorePipeline(store, actorUsers) {
  const senders = [...actorUsers].filter(Boolean)
  if (!senders.length) {
    return store
  }
  const unique = new Map()
  for (const u of senders) {
    const key = u.organizationId ? `org:${u.organizationId}` : `user:${u.id}`
    if (!unique.has(key)) unique.set(key, u)
  }
  const merged = []
  for (const u of unique.values()) {
    const { pipelineStore } = await loadPipelineStoreContext(u)
    merged.push(...listPipelineSavedEntries(pipelineStore, u))
  }
  return { ...store, savedLeads: merged }
}

function applyEnrollmentWrites(enrollments, pendingWrites) {
  for (const write of pendingWrites) {
    const e = enrollments.find((x) => x.id === write.enrollmentId)
    if (!e) continue
    if (write.kind === 'failed') {
      e.status = 'failed'
      e.nextSendAt = null
      e.lastError = String(write.error || 'Failed').slice(0, 240)
      e.updatedAt = new Date().toISOString()
    } else if (write.kind === 'unsubscribed') {
      e.status = 'unsubscribed'
      e.updatedAt = new Date().toISOString()
    } else if (write.kind === 'sent') {
      e.sentCount = (e.sentCount || 0) + 1
      e.lastSentAt = write.result.sentAt
      e.lastSendMessageId =
        write.result.logPayload?.gmailMessageId ||
        write.result.logPayload?.resendId ||
        write.result.id ||
        null
      e.lastSendProvider = write.result.provider || write.result.logPayload?.provider || null
      e.lastError = null
      e.updatedAt = new Date().toISOString()
      if (write.isLast) {
        e.status = 'completed'
        e.nextSendAt = null
      } else {
        e.currentStep = write.nextStep
        e.nextSendAt = addDaysIso(write.delayDays || 0)
      }
    }
  }
  return enrollments
}

export async function processDueEnrollments({
  limit = MARKETING_SEND_CHUNK,
  campaignId = null,
  actorUser = null,
} = {}) {
  if (!campaignId) {
    const meta = await readStore({ only: MARKETING_META_SLICES })
    const active = (meta.marketingCampaigns || []).filter((c) => c.status === 'active')
    const agg = { processed: 0, sent: 0, failed: 0, errors: [] }
    for (const campaign of active) {
      if (agg.processed >= limit) break
      const chunk = await processDueEnrollments({
        limit: limit - agg.processed,
        campaignId: campaign.id,
        actorUser: resolveCampaignSender(meta, campaign),
      })
      agg.processed += chunk.processed
      agg.sent += chunk.sent
      agg.failed += chunk.failed
      if (chunk.firstError) agg.errors.push(chunk.firstError)
    }
    return {
      ...agg,
      errors: [...new Set(agg.errors)].slice(0, 5),
      firstError: agg.errors[0] || null,
    }
  }

  let store = await readStore({
    only: campaignId ? MARKETING_SEND_META_SLICES : MARKETING_META_SLICES,
  })
  if (campaignId) {
    const { readCampaignSendShard } = await import('./marketingCampaignSendShard.js')
    const sendCampaign = await readCampaignSendShard(campaignId)
    if (sendCampaign) {
      store = { ...store, marketingCampaigns: [sendCampaign] }
    } else {
      store = await readStore({ only: MARKETING_SEND_READ_SLICES })
    }
    const campaignRow = (store.marketingCampaigns || [])[0]
    const needsTemplate =
      campaignRow?.templateId &&
      !(campaignRow?.steps?.[0]?.body || campaignRow?.steps?.[0]?.blocks?.length)
    if (needsTemplate) {
      const templates = await readStore({ only: ['marketingTemplates'] })
      store = { ...store, marketingTemplates: templates.marketingTemplates || [] }
    }
  }
  const now = new Date().toISOString()
  const due = campaignId ? await readDueCampaignEnrollments(campaignId, limit) : []

  let sent = 0
  let failed = 0
  const pendingWrites = []
  const errors = []

  for (const enrollment of due) {
    const campaign = (store.marketingCampaigns || []).find((c) => c.id === enrollment.campaignId)
    if (!campaign || campaign.status !== 'active') continue

    if (campaign.channel === 'whatsapp') {
      const user = resolveCampaignSender(store, campaign)
      if (!user) {
        const msg = 'Campaign owner account not found'
        errors.push(msg)
        pendingWrites.push({
          kind: 'failed',
          enrollmentId: enrollment.id,
          chunkIndex: enrollment.chunkIndex,
          campaignId: campaign.id,
          error: msg,
        })
        failed += 1
        continue
      }

      if (isWhatsAppCloudConfigured(user, store)) {
        try {
          const result = await sendWhatsAppCampaignEnrollment(user, enrollment.id, { store })
          if (result.sent) {
            sent += 1
            await new Promise((r) => setTimeout(r, 300))
          } else {
            failed += 1
          }
        } catch (e) {
          await markEnrollmentFailed(enrollment.id, e.message || 'WhatsApp send failed', campaign.id)
          await bumpCampaignStats(campaign.id, { failed: 1 })
          failed += 1
        }
      } else {
        await refreshWhatsAppEnrollmentMessages(store, user, campaign, { limit: 5 })
      }
      continue
    }

    const user = resolveCampaignSender(store, campaign)
    if (!user) {
      const msg = 'Campaign owner account not found'
      errors.push(msg)
      pendingWrites.push({
        kind: 'failed',
        enrollmentId: enrollment.id,
        chunkIndex: enrollment.chunkIndex,
        campaignId: campaign.id,
        error: msg,
      })
      failed += 1
      continue
    }

    const template = getMarketingTemplate(store, user, campaign.templateId)
    const { steps } = resolveCampaignContent(campaign, template)
    const step = steps[enrollment.currentStep]
    if (!step?.subject || (!step?.body && !step?.blocks?.length)) {
      const err = 'Missing step content'
      errors.push(err)
      pendingWrites.push({
        kind: 'failed',
        enrollmentId: enrollment.id,
        chunkIndex: enrollment.chunkIndex,
        campaignId: campaign.id,
        error: err,
      })
      failed += 1
      continue
    }

    const lead = leadForEnrollment(store, user, enrollment)
    if (!lead) {
      const err = 'Lead not in pipeline'
      errors.push(err)
      pendingWrites.push({
        kind: 'failed',
        enrollmentId: enrollment.id,
        chunkIndex: enrollment.chunkIndex,
        campaignId: campaign.id,
        error: err,
      })
      failed += 1
      continue
    }
    const result = await sendMarketingMessage({
      store,
      user,
      lead,
      leadId: enrollment.leadId,
      subject: step.subject,
      body: step.body,
      blocks: step.blocks,
      design: step.design,
      previewText: step.previewText,
      template,
      campaignId: campaign.id,
      stepIndex: enrollment.currentStep,
      enrollmentId: enrollment.id,
    })

    if (result.suppressed) {
      pendingWrites.push({
        kind: 'unsubscribed',
        enrollmentId: enrollment.id,
        chunkIndex: enrollment.chunkIndex,
        campaignId: campaign.id,
      })
      continue
    }

    if (!result.sent) {
      const err = result.error || 'Send failed'
      errors.push(err)
      pendingWrites.push({
        kind: 'failed',
        enrollmentId: enrollment.id,
        chunkIndex: enrollment.chunkIndex,
        campaignId: campaign.id,
        error: err,
      })
      failed += 1
      continue
    }

    sent += 1
    const nextStep = enrollment.currentStep + 1
    pendingWrites.push({
      kind: 'sent',
      enrollmentId: enrollment.id,
      chunkIndex: enrollment.chunkIndex,
      campaignId: campaign.id,
      result,
      nextStep,
      isLast: nextStep >= steps.length,
      delayDays: steps[nextStep]?.delayDays,
      user,
    })
  }

  let saveError = null
  if (pendingWrites.length && campaignId) {
    try {
      await patchCampaignEnrollments(campaignId, pendingWrites, applyEnrollmentWrites)
      await syncCampaignStatsAfterSends(campaignId, pendingWrites)
    } catch (err) {
      saveError = err?.message || 'Database save failed'
      console.error('campaign send save failed:', saveError)
      if (sent === 0 && failed === 0) {
        throw err
      }
    }
  }

  return {
    processed: due.length,
    sent,
    failed,
    errors: [...new Set(errors)].slice(0, 5),
    firstError: errors[0] || saveError || null,
    saveError,
  }
}

async function markEnrollmentStatus(enrollmentId, status) {
  await updateStore((draft) => {
    const e = draft.marketingEnrollments.find((x) => x.id === enrollmentId)
    if (!e) return draft
    e.status = status
    e.updatedAt = new Date().toISOString()
    if (status === 'unsubscribed') {
      const c = draft.marketingCampaigns.find((x) => x.id === e.campaignId)
      if (c) {
        c.stats = c.stats || {}
        c.stats.unsubscribed = (c.stats.unsubscribed || 0) + 1
        c.updatedAt = e.updatedAt
      }
    }
    return draft
  })
}

async function markEnrollmentFailed(enrollmentId, error, campaignId, chunkIndex = null) {
  if (campaignId) {
    await patchCampaignEnrollments(
      campaignId,
      [
        {
          kind: 'failed',
          enrollmentId,
          chunkIndex,
          error: String(error || 'Failed').slice(0, 240),
        },
      ],
      applyEnrollmentWrites
    )
    return
  }
  await updateStore((draft) => {
    const e = draft.marketingEnrollments.find((x) => x.id === enrollmentId)
    if (!e) return draft
    e.lastError = String(error || 'Failed').slice(0, 240)
    e.updatedAt = new Date().toISOString()
    return draft
  })
}

async function bumpCampaignStats(campaignId, delta) {
  await updateStorePartial(['marketingCampaigns'], (draft) => {
    const c = draft.marketingCampaigns.find((x) => x.id === campaignId)
    if (!c) return draft
    c.stats = c.stats || {}
    if (delta.failed) c.stats.failed = (c.stats.failed || 0) + delta.failed
    c.updatedAt = new Date().toISOString()
    return draft
  })
}

export async function maybeCompleteCampaigns(campaignId = null) {
  if (campaignId) {
    const enrollments = await readCampaignEnrollments(campaignId)
    await updateStorePartial(['marketingCampaigns'], (draft) => {
      const campaign = draft.marketingCampaigns.find((x) => x.id === campaignId)
      applyCampaignCompletionForCampaign(campaign, enrollments)
      return draft
    })
    return
  }
  const meta = await readStore({ only: ['marketingCampaigns'] })
  for (const campaign of (meta.marketingCampaigns || []).filter((c) => c.status === 'active')) {
    await maybeCompleteCampaigns(campaign.id)
  }
}

async function enrichCampaignEngagementFromEnrollments(campaigns, store, user) {
  if (!campaigns?.length) return campaigns || []

  const needsEngagement = campaigns.filter(
    (c) => (c.stats?.sent || 0) > 0 || c.status === 'active' || c.status === 'completed'
  )
  if (!needsEngagement.length) return campaigns

  const byId = new Map()
  const batchSize = 6
  for (let i = 0; i < needsEngagement.length; i += batchSize) {
    const batch = needsEngagement.slice(i, i + batchSize)
    await Promise.all(
      batch.map(async (c) => {
        try {
          const rows = await readCampaignEnrollments(c.id)
          const campaignEvents = filterMarketingEventsForCampaign(store, user, c.id)
          const engagement = summarizeEnrollmentEngagement(
            rows,
            c.stats?.sent || 0,
            campaignEvents
          )
          byId.set(c.id, engagement)
        } catch (err) {
          console.error('campaign engagement rollup failed:', c.id, err?.message || err)
        }
      })
    )
  }

  return campaigns.map((c) => {
    const engagement = byId.get(c.id)
    if (!engagement) return c
    return {
      ...c,
      analytics: { ...(c.analytics || {}), ...engagement },
      stats: { ...(c.stats || {}), ...engagement },
    }
  })
}

export async function marketingOverview(store, user, options = {}) {
  const light = Boolean(options.light)
  const events = filterMarketingEvents(store, user)
  let campaigns = enrichMarketingRows(
    store,
    user,
    filterMarketingCampaignsVisible(store.marketingCampaigns, user).map((c) => {
      const analytics = buildCampaignAnalyticsFromStats(c, events)
      return {
        ...c,
        analytics,
        stats: { ...c.stats, ...analytics },
      }
    })
  )
  campaigns = await mergeCampaignStatsShards(campaigns)
  campaigns = await enrichCampaignEngagementFromEnrollments(campaigns, store, user)

  const listRows = light
    ? filterMarketingRows(store.marketingLists, user).map((row) => ({
        ...row,
        leadIds: Array.isArray(row.leadIds) ? row.leadIds : [],
      }))
    : filterMarketingAssets(store, user, store.marketingLists, {
        filterLeadIds: true,
        hideEmptyLists: false,
      })

  return {
    lists: enrichMarketingRows(store, user, listRows),
    templates: enrichMarketingRows(
      store,
      user,
      filterMarketingRows(store.marketingTemplates, user)
    ),
    campaigns,
    forms: enrichMarketingRows(store, user, filterMarketingRows(store.marketingForms, user)),
    suppressions: filterMarketingRows(store.marketingSuppressions, user).length,
    summary: marketingSummary(campaigns, events),
    marketingScope: user.organizationId ? (user.isOrgAdmin ? 'org_admin' : 'member') : 'individual',
  }
}
