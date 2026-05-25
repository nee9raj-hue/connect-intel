import { createId, readStore, updateStore } from './store.js'
import { findPipelineEntry } from './pipelineAccess.js'
import {
  canAccessMarketingAsset,
  enrichMarketingRows,
  filterMarketingAssets,
  filterMarketingEnrollmentsForUser,
  filterMarketingRows,
  marketingScopeKey,
} from './marketingAccess.js'
import { buildCampaignAnalytics, marketingSummary } from './marketingAnalytics.js'
import { filterMarketingEvents } from './marketingEvents.js'
import { logMarketingSend, sendMarketingMessage } from './marketingSend.js'
import { isEmailSuppressed } from './marketingUnsubscribe.js'
import {
  buildEnrollmentWhatsAppPayload,
  listEligibleWhatsAppLeads,
  refreshWhatsAppEnrollmentMessages,
  sendWhatsAppCampaignEnrollment,
} from './marketingWhatsApp.js'
import { isWhatsAppCloudConfigured } from './whatsappCloud.js'

export const MAX_LIST_LEADS = 200
export const MAX_SEQUENCE_STEPS = 5

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

export function getMarketingCampaign(store, user, campaignId) {
  const row = (store.marketingCampaigns || []).find((c) => c.id === campaignId)
  if (!row || !canAccessMarketingAsset(row, user)) return null
  return row
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
  const eligible = []
  for (const leadId of unique) {
    const entry = findPipelineEntry(store, user, leadId)
    if (!entry) continue
    const lead = entry.lead || entry
    const email = String(lead.email || '').trim().toLowerCase()
    if (!email.includes('@')) continue
    const scope = user.organizationId
      ? { organizationId: user.organizationId, createdByUserId: null }
      : { organizationId: null, createdByUserId: user.id }
    if (isEmailSuppressed(store, { ...scope, email })) continue
    eligible.push({ leadId, lead, email })
  }
  return eligible
}

function addDaysIso(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

export async function enrollCampaign(store, user, campaign, list) {
  const channel = campaign.channel || 'email'
  const template = getMarketingTemplate(store, user, campaign.templateId)
  const { steps } = resolveCampaignContent(campaign, template)
  const scope = marketingScopeKey(user)
  const now = new Date().toISOString()

  const eligible =
    channel === 'whatsapp'
      ? listEligibleWhatsAppLeads(store, user, list.leadIds)
      : listEligibleLeads(store, user, list.leadIds)

  const enrollments = eligible.map((row) => {
    const leadId = row.leadId
    const entry = findPipelineEntry(store, user, leadId)
    const lead = entry?.lead || entry
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
      createdAt: now,
      updatedAt: now,
    }
  })

  await updateStore((draft) => {
    const c = draft.marketingCampaigns.find((x) => x.id === campaign.id)
    if (!c) return draft
    c.status = 'active'
    c.startedAt = c.startedAt || now
    c.updatedAt = now
    c.stats = {
      enrolled: enrollments.length,
      sent: c.stats?.sent || 0,
      failed: c.stats?.failed || 0,
      unsubscribed: c.stats?.unsubscribed || 0,
      steps: steps.length,
    }
    draft.marketingEnrollments = draft.marketingEnrollments || []
    draft.marketingEnrollments.push(...enrollments)
    return draft
  })

  return enrollments.length
}

export async function processDueEnrollments({ limit = 40, campaignId = null } = {}) {
  const store = await readStore()
  const now = new Date().toISOString()
  const due = (store.marketingEnrollments || [])
    .filter((e) => {
      if (e.status !== 'active') return false
      if (campaignId && e.campaignId !== campaignId) return false
      return e.nextSendAt && e.nextSendAt <= now
    })
    .slice(0, limit)

  let sent = 0
  let failed = 0

  for (const enrollment of due) {
    const campaign = (store.marketingCampaigns || []).find((c) => c.id === enrollment.campaignId)
    if (!campaign || campaign.status !== 'active') continue

    if (campaign.channel === 'whatsapp') {
      const user = (store.users || []).find((u) => {
        if (campaign.organizationId) return u.organizationId === campaign.organizationId
        return u.id === campaign.createdByUserId
      })
      if (!user) continue

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
          await markEnrollmentFailed(enrollment.id, e.message || 'WhatsApp send failed')
          await bumpCampaignStats(campaign.id, { failed: 1 })
          failed += 1
        }
      } else {
        await refreshWhatsAppEnrollmentMessages(store, user, campaign, { limit: 5 })
      }
      continue
    }

    const user = (store.users || []).find((u) => {
      if (campaign.organizationId) return u.organizationId === campaign.organizationId
      return u.id === campaign.createdByUserId
    })
    if (!user) continue

    const template = getMarketingTemplate(store, user, campaign.templateId)
    const { steps } = resolveCampaignContent(campaign, template)
    const step = steps[enrollment.currentStep]
    if (!step?.subject || (!step?.body && !step?.blocks?.length)) {
      await markEnrollmentFailed(enrollment.id, 'Missing step content')
      failed += 1
      continue
    }

    const entry = findPipelineEntry(store, user, enrollment.leadId)
    if (!entry) {
      await markEnrollmentFailed(enrollment.id, 'Lead not in pipeline')
      failed += 1
      continue
    }

    const lead = entry.lead || entry
    const freshStore = await readStore()
    const result = await sendMarketingMessage({
      store: freshStore,
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
      await markEnrollmentStatus(enrollment.id, 'unsubscribed')
      continue
    }

    if (!result.sent) {
      await markEnrollmentFailed(enrollment.id, result.error || 'Send failed')
      await bumpCampaignStats(campaign.id, { failed: 1 })
      failed += 1
      continue
    }

    await logMarketingSend(user, result)
    sent += 1

    const nextStep = enrollment.currentStep + 1
    const isLast = nextStep >= steps.length
    await updateStore((draft) => {
      const e = draft.marketingEnrollments.find((x) => x.id === enrollment.id)
      if (!e) return draft
      e.sentCount = (e.sentCount || 0) + 1
      e.lastSentAt = result.sentAt
      e.lastError = null
      e.updatedAt = new Date().toISOString()
      if (isLast) {
        e.status = 'completed'
        e.nextSendAt = null
      } else {
        e.currentStep = nextStep
        e.nextSendAt = addDaysIso(steps[nextStep].delayDays || 0)
      }
      const c = draft.marketingCampaigns.find((x) => x.id === campaign.id)
      if (c) {
        c.stats = c.stats || {}
        c.stats.sent = (c.stats.sent || 0) + 1
        c.updatedAt = new Date().toISOString()
      }
      return draft
    })
  }

  await maybeCompleteCampaigns()
  return { processed: due.length, sent, failed }
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

async function markEnrollmentFailed(enrollmentId, error) {
  await updateStore((draft) => {
    const e = draft.marketingEnrollments.find((x) => x.id === enrollmentId)
    if (!e) return draft
    e.lastError = String(error || 'Failed').slice(0, 240)
    e.updatedAt = new Date().toISOString()
    return draft
  })
}

async function bumpCampaignStats(campaignId, delta) {
  await updateStore((draft) => {
    const c = draft.marketingCampaigns.find((x) => x.id === campaignId)
    if (!c) return draft
    c.stats = c.stats || {}
    if (delta.failed) c.stats.failed = (c.stats.failed || 0) + delta.failed
    c.updatedAt = new Date().toISOString()
    return draft
  })
}

export async function maybeCompleteCampaigns() {
  await updateStore((draft) => {
    for (const campaign of draft.marketingCampaigns || []) {
      if (campaign.status !== 'active') continue
      const enrollments = (draft.marketingEnrollments || []).filter((e) => e.campaignId === campaign.id)
      if (!enrollments.length) continue
      const pending = enrollments.some((e) => e.status === 'active')
      if (!pending) {
        campaign.status = 'completed'
        campaign.completedAt = new Date().toISOString()
        campaign.updatedAt = campaign.completedAt
      }
    }
    return draft
  })
}

export function marketingOverview(store, user) {
  const events = filterMarketingEvents(store, user)
  const scopedEnrollments = filterMarketingEnrollmentsForUser(
    store,
    user,
    store.marketingEnrollments
  )
  const campaigns = enrichMarketingRows(
    store,
    user,
    filterMarketingRows(store.marketingCampaigns, user).map((c) => {
      const enrollments = scopedEnrollments.filter((e) => e.campaignId === c.id)
      const analytics = buildCampaignAnalytics(c, enrollments, events)
      return {
        ...c,
        analytics,
        stats: { ...c.stats, ...analytics },
      }
    })
  )

  return {
    lists: enrichMarketingRows(
      store,
      user,
      filterMarketingAssets(store, user, store.marketingLists, { filterLeadIds: true })
    ),
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
