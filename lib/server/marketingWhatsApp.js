import { updateStore } from './store.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { appendActivity, normalizeExtendedCrm } from './crmWorkflow.js'
import { resolveMessageContent } from './marketingEmailDesign.js'
import { buildWhatsAppUrl, normalizePhoneDigits } from './phoneUtils.js'
import { rowInMarketingScope } from './marketingAccess.js'
import { resolveWhatsAppCloudConfig, sendWhatsAppCloudMessage } from './whatsappCloud.js'
import { recordWhatsAppOutbound } from './whatsappInbox.js'

const WHATSAPP_MAX_CHARS = 3500

export function listEligibleWhatsAppLeads(store, user, leadIds) {
  const unique = [...new Set(leadIds || [])]
  const eligible = []
  for (const leadId of unique) {
    const entry = findPipelineEntry(store, user, leadId)
    if (!entry) continue
    const lead = entry.lead || entry
    const digits = normalizePhoneDigits(lead.phone)
    if (!digits) continue
    eligible.push({ leadId, lead, phone: digits })
  }
  return eligible
}

export function resolveWhatsAppStepContent(campaign, template, step, lead) {
  const resolved = resolveMessageContent(
    {
      subject: step?.subject || campaign?.subject,
      body: step?.body || campaign?.body,
      blocks: step?.blocks || campaign?.blocks,
      design: step?.design || campaign?.design,
      previewText: step?.previewText || campaign?.previewText,
    },
    template,
    lead
  )
  let text = String(resolved.body || '').trim()
  text = text.replace(/\n---\n[\s\S]*$/m, '').trim()
  text = text.replace(/^unsubscribe:.*$/gim, '').trim()
  if (text.length > WHATSAPP_MAX_CHARS) {
    text = `${text.slice(0, WHATSAPP_MAX_CHARS - 3)}...`
  }
  return text
}

export function buildEnrollmentWhatsAppPayload(store, user, campaign, template, enrollment, step) {
  const entry = findPipelineEntry(store, user, enrollment.leadId)
  if (!entry) return null
  const lead = entry.lead || entry
  const phone = enrollment.contactPhone || normalizePhoneDigits(lead.phone)
  if (!phone) return null
  const message = resolveWhatsAppStepContent(campaign, template, step, lead)
  const url = buildWhatsAppUrl(lead.phone || phone, message)
  if (!url) return null
  return { message, url, phone }
}

export async function refreshWhatsAppEnrollmentMessages(store, user, campaign, { limit = 50 } = {}) {
  const { getMarketingTemplate, resolveCampaignContent } = await import('./marketingCampaigns.js')
  const template = getMarketingTemplate(store, user, campaign.templateId)
  const { steps } = resolveCampaignContent(campaign, template)
  const now = new Date().toISOString()
  const due = (store.marketingEnrollments || [])
    .filter((e) => {
      if (e.campaignId !== campaign.id) return false
      if (e.status !== 'active') return false
      return !e.nextSendAt || e.nextSendAt <= now
    })
    .slice(0, limit)

  let updated = 0
  for (const enrollment of due) {
    const step = steps[enrollment.currentStep]
    if (!step) continue
    const payload = buildEnrollmentWhatsAppPayload(store, user, campaign, template, enrollment, step)
    if (!payload) continue
    await updateStore((draft) => {
      const e = draft.marketingEnrollments.find((x) => x.id === enrollment.id)
      if (!e) return draft
      e.whatsappMessage = payload.message
      e.whatsappUrl = payload.url
      e.contactPhone = payload.phone
      e.updatedAt = now
      return draft
    })
    updated += 1
  }
  return { updated, due: due.length }
}

function addDaysIso(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function resolveCampaignTemplateOptions(campaign, config) {
  const name =
    String(campaign?.whatsappTemplateName || '').trim() ||
    config?.defaultTemplateName ||
    null
  const language =
    String(campaign?.whatsappTemplateLanguage || '').trim() ||
    config?.defaultTemplateLanguage ||
    'en'
  return { templateName: name, templateLanguage: language }
}

/**
 * Send one WhatsApp campaign step via Cloud API, then advance enrollment (same as manual log).
 */
export async function sendWhatsAppCampaignEnrollment(user, enrollmentId, { store: storeIn } = {}) {
  const { readStore } = await import('./store.js')
  const {
    getMarketingCampaign,
    getMarketingTemplate,
    resolveCampaignContent,
    maybeCompleteCampaigns,
  } = await import('./marketingCampaigns.js')

  const store = storeIn || (await readStore())
  const enrollment = (store.marketingEnrollments || []).find(
    (e) => e.id === enrollmentId && rowInMarketingScope(e, user)
  )
  if (!enrollment) throw new Error('Enrollment not found')

  const campaign = getMarketingCampaign(store, user, enrollment.campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.channel !== 'whatsapp') throw new Error('Not a WhatsApp campaign')

  const config = resolveWhatsAppCloudConfig(user, store)
  if (!config) {
    throw new Error('WhatsApp Business API is not connected')
  }

  const template = getMarketingTemplate(store, user, campaign.templateId)
  const { steps } = resolveCampaignContent(campaign, template)
  const step = steps[enrollment.currentStep]
  if (!step) throw new Error('No step for this enrollment')

  const payload = buildEnrollmentWhatsAppPayload(store, user, campaign, template, enrollment, step)
  if (!payload) throw new Error('Invalid phone for WhatsApp')

  const { templateName, templateLanguage } = resolveCampaignTemplateOptions(campaign, config)
  const sendResult = await sendWhatsAppCloudMessage(config, {
    to: payload.phone,
    body: payload.message,
    templateName,
    templateLanguage,
    templateBodyParams: templateName ? [payload.message.slice(0, 1024)] : [],
  })

  if (!sendResult.ok) {
    await updateStore((draft) => {
      const e = draft.marketingEnrollments.find((x) => x.id === enrollmentId)
      if (e) {
        e.lastError = String(sendResult.error || 'Send failed').slice(0, 240)
        e.updatedAt = new Date().toISOString()
      }
      const c = draft.marketingCampaigns.find((x) => x.id === campaign.id)
      if (c) {
        c.stats = c.stats || {}
        c.stats.failed = (c.stats.failed || 0) + 1
        c.updatedAt = e?.updatedAt || new Date().toISOString()
      }
      return draft
    })
    return { ok: false, error: sendResult.error, sent: false }
  }

  const advance = await advanceWhatsAppEnrollmentAfterSend(user, enrollmentId, {
    campaign,
    payload,
    messageId: sendResult.messageId,
  })
  return { ok: true, sent: true, ...advance, messageId: sendResult.messageId }
}

async function advanceWhatsAppEnrollmentAfterSend(user, enrollmentId, { campaign, payload, messageId }) {
  const { readStore } = await import('./store.js')
  const { getMarketingCampaign, getMarketingTemplate, resolveCampaignContent, maybeCompleteCampaigns } =
    await import('./marketingCampaigns.js')

  const store = await readStore()
  const enrollment = (store.marketingEnrollments || []).find((e) => e.id === enrollmentId)
  if (!enrollment) throw new Error('Enrollment not found')

  const template = getMarketingTemplate(store, user, campaign.templateId)
  const { steps } = resolveCampaignContent(campaign, template)
  const sentAt = new Date().toISOString()
  const summary = payload.message.slice(0, 120)
  const nextStep = enrollment.currentStep + 1
  const isLast = nextStep >= steps.length

  await updateStore((draft) => {
    const e = draft.marketingEnrollments.find((x) => x.id === enrollmentId)
    if (!e) return draft
    const ent = findPipelineEntry(draft, user, enrollment.leadId)
    if (ent) {
      ent.crm = appendActivity(normalizeExtendedCrm(ent.crm), {
        type: 'whatsapp',
        summary: `Campaign "${campaign.name}" — ${summary}`,
        userId: user.id,
        userName: user.name || user.email,
        meta: {
          campaignId: campaign.id,
          enrollmentId,
          stepIndex: enrollment.currentStep,
          messageId: messageId || null,
          autoSend: true,
        },
      })
      const lead = ent.lead || ent
      recordWhatsAppOutbound(draft, user, {
        phone: payload.phone,
        body: payload.message,
        messageId,
        leadId: enrollment.leadId,
        leadName: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company,
      })
    }
    e.sentCount = (e.sentCount || 0) + 1
    e.lastSentAt = sentAt
    e.lastError = null
    e.whatsappMessage = payload.message
    e.whatsappUrl = payload.url
    e.updatedAt = sentAt
    if (isLast) {
      e.status = 'completed'
      e.nextSendAt = null
    } else {
      e.currentStep = nextStep
      e.nextSendAt = addDaysIso(steps[nextStep].delayDays || 0)
      e.whatsappMessage = null
      e.whatsappUrl = null
    }
    const c = draft.marketingCampaigns.find((x) => x.id === campaign.id)
    if (c) {
      c.stats = c.stats || {}
      c.stats.sent = (c.stats.sent || 0) + 1
      c.updatedAt = sentAt
    }
    return draft
  })

  if (isLast) {
    await maybeCompleteCampaigns()
  } else {
    const fresh = await readStore()
    const updatedCampaign = getMarketingCampaign(fresh, user, campaign.id)
    if (updatedCampaign) {
      await refreshWhatsAppEnrollmentMessages(fresh, user, updatedCampaign, { limit: 1 })
    }
  }

  return { sentAt, completed: isLast, currentStep: isLast ? enrollment.currentStep : nextStep }
}

export async function logWhatsAppCampaignSend(user, enrollmentId) {
  const { readStore } = await import('./store.js')
  const { getMarketingCampaign, getMarketingTemplate, resolveCampaignContent } = await import(
    './marketingCampaigns.js'
  )
  const store = await readStore()
  const enrollment = (store.marketingEnrollments || []).find(
    (e) => e.id === enrollmentId && rowInMarketingScope(e, user)
  )
  if (!enrollment) throw new Error('Enrollment not found')

  const campaign = getMarketingCampaign(store, user, enrollment.campaignId)
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.channel !== 'whatsapp') throw new Error('Not a WhatsApp campaign')

  const template = getMarketingTemplate(store, user, campaign.templateId)
  const { steps } = resolveCampaignContent(campaign, template)
  const step = steps[enrollment.currentStep]
  if (!step) throw new Error('No step for this enrollment')

  const entry = findPipelineEntry(store, user, enrollment.leadId)
  if (!entry) throw new Error('Lead not in pipeline')

  const payload = buildEnrollmentWhatsAppPayload(store, user, campaign, template, enrollment, step)
  if (!payload) throw new Error('Invalid phone for WhatsApp')

  const advance = await advanceWhatsAppEnrollmentAfterSend(user, enrollmentId, { campaign, payload })
  return {
    ok: true,
    sentAt: advance.sentAt,
    completed: advance.completed,
    currentStep: advance.currentStep,
  }
}
