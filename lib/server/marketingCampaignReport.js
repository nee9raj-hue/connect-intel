import { createId } from './store.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { getMarketingCampaign, getMarketingTemplate, resolveCampaignContent } from './marketingCampaigns.js'
import { filterMarketingEvents } from './marketingEvents.js'
import {
  filterMarketingEnrollmentsForUser,
  marketingScopeKey,
  resolveMarketingCreatorName,
} from './marketingAccess.js'
import { buildEnrollmentWhatsAppPayload } from './marketingWhatsApp.js'

function isBounceError(error) {
  const e = String(error || '').toLowerCase()
  return /bounce|bounced|undeliver|invalid recipient|mailbox unavailable|mailbox not found|550 |554 |550-5|user unknown|address rejected|does not exist|no such user/.test(
    e
  )
}

function leadFromEntry(entry, fallbackEmail) {
  const lead = entry?.lead || {}
  const first = lead.firstName || ''
  const last = lead.lastName || ''
  const name = [first, last].filter(Boolean).join(' ') || lead.name || ''
  return {
    leadId: lead.id || entry?.contactId || null,
    name: name || fallbackEmail || 'Unknown',
    company: lead.company || lead.companyName || '',
    email: lead.email || fallbackEmail || '',
    title: lead.title || '',
  }
}

function deliveryStatusForEnrollment(enrollment) {
  if (enrollment.status === 'unsubscribed') return 'unsubscribed'
  if (enrollment.lastError) {
    return isBounceError(enrollment.lastError) ? 'bounced' : 'failed'
  }
  if ((enrollment.sentCount || 0) > 0) return 'delivered'
  if (enrollment.status === 'active') return 'pending'
  if (enrollment.status === 'completed' && (enrollment.sentCount || 0) === 0) return 'failed'
  return 'pending'
}

/**
 * Full campaign report: KPIs + per-recipient rows with opens/clicks/bounces.
 */
export function buildCampaignReport(store, user, campaignId) {
  const campaign = getMarketingCampaign(store, user, campaignId)
  if (!campaign) return null

  const enrollments = filterMarketingEnrollmentsForUser(store, user, store.marketingEnrollments).filter(
    (e) => e.campaignId === campaignId
  )
  const events = filterMarketingEvents(store, user).filter((ev) => ev.campaignId === campaignId)

  const eventsByLead = new Map()
  for (const ev of events) {
    const key = ev.leadId || ev.enrollmentId || 'unknown'
    if (!eventsByLead.has(key)) eventsByLead.set(key, [])
    eventsByLead.get(key).push(ev)
  }

  const isWhatsApp = campaign.channel === 'whatsapp'
  const template = getMarketingTemplate(store, user, campaign.templateId)
  const { steps } = resolveCampaignContent(campaign, template)

  const recipients = []
  let bounced = 0
  let failed = 0
  let delivered = 0
  let pending = 0
  let unsubscribed = 0
  let uniqueOpens = 0
  let uniqueClicks = 0
  let totalOpens = 0
  let totalClicks = 0

  for (const enrollment of enrollments) {
    const entry = findPipelineEntry(store, user, enrollment.leadId)
    const contact = leadFromEntry(entry, enrollment.contactEmail)
    const deliveryStatus = deliveryStatusForEnrollment(enrollment)

    if (deliveryStatus === 'bounced') bounced += 1
    else if (deliveryStatus === 'failed') failed += 1
    else if (deliveryStatus === 'delivered') delivered += 1
    else if (deliveryStatus === 'unsubscribed') unsubscribed += 1
    else pending += 1

    const leadEvents = eventsByLead.get(enrollment.leadId) || eventsByLead.get(enrollment.id) || []
    const openEvents = leadEvents.filter((e) => e.type === 'open')
    const clickEvents = leadEvents.filter((e) => e.type === 'click')
    const opens = Math.max(enrollment.openCount || 0, openEvents.length)
    const clicks = Math.max(enrollment.clickCount || 0, clickEvents.length)

    totalOpens += opens
    totalClicks += clicks
    if (opens > 0) uniqueOpens += 1
    if (clicks > 0) uniqueClicks += 1

    const clickUrls = [...new Set(clickEvents.map((e) => e.url).filter(Boolean))]

    const step = steps[enrollment.currentStep] || steps[0]
    let whatsappMessage = enrollment.whatsappMessage || null
    let whatsappUrl = enrollment.whatsappUrl || null
    let phone = enrollment.contactPhone || entry?.lead?.phone || ''
    if (isWhatsApp && entry && step && (!whatsappMessage || !whatsappUrl)) {
      const wa = buildEnrollmentWhatsAppPayload(store, user, campaign, template, enrollment, step)
      if (wa) {
        whatsappMessage = wa.message
        whatsappUrl = wa.url
        phone = wa.phone
      }
    }

    recipients.push({
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
      email: contact.email || enrollment.contactEmail,
      phone,
      whatsappMessage,
      whatsappUrl,
      name: contact.name,
      company: contact.company,
      title: contact.title,
      deliveryStatus,
      enrollmentStatus: enrollment.status,
      sentCount: enrollment.sentCount || 0,
      lastSentAt: enrollment.lastSentAt,
      lastError: enrollment.lastError || null,
      opens,
      clicks,
      firstOpenAt: openEvents[0]?.createdAt || null,
      lastOpenAt: openEvents[openEvents.length - 1]?.createdAt || null,
      lastClickAt: clickEvents[clickEvents.length - 1]?.createdAt || null,
      clickUrls: clickUrls.slice(0, 10),
      currentStep: enrollment.currentStep,
    })
  }

  recipients.sort((a, b) => {
    const rank = (r) => {
      if (r.clicks > 0) return 0
      if (r.opens > 0) return 1
      if (r.deliveryStatus === 'bounced') return 2
      if (r.deliveryStatus === 'failed') return 3
      return 4
    }
    const d = rank(a) - rank(b)
    if (d !== 0) return d
    return (a.name || '').localeCompare(b.name || '')
  })

  const sent = campaign.stats?.sent || recipients.reduce((n, r) => n + (r.sentCount || 0), 0)
  const enrolled = recipients.length

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      type: campaign.type,
      channel: campaign.channel || 'email',
      listId: campaign.listId,
      templateId: campaign.templateId,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      createdAt: campaign.createdAt,
      createdByUserId: campaign.createdByUserId || null,
      createdByName: resolveMarketingCreatorName(store, campaign.createdByUserId),
      steps: campaign.steps || [],
    },
    stats: {
      enrolled,
      sent,
      delivered,
      pending,
      bounced,
      failed,
      unsubscribed,
      uniqueOpens,
      uniqueClicks,
      totalOpens,
      totalClicks,
      openRate: sent > 0 ? Math.round((uniqueOpens / sent) * 100) : 0,
      clickRate: sent > 0 ? Math.round((uniqueClicks / sent) * 100) : 0,
      bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
    },
    recipients,
  }
}

export function duplicateMarketingCampaign(store, user, campaignId) {
  const source = getMarketingCampaign(store, user, campaignId)
  if (!source) return null

  const now = new Date().toISOString()
  const baseName = String(source.name || 'Campaign').trim()
  const copyName = baseName.startsWith('Copy of ') ? baseName : `Copy of ${baseName}`

  const campaign = {
    id: createId('mcamp'),
    ...marketingScopeKey(user),
    name: copyName.slice(0, 120),
    type: source.type,
    channel: source.channel || 'email',
    listId: source.listId,
    templateId: source.templateId || null,
    subject: source.subject,
    body: source.body,
    blocks: source.blocks ? JSON.parse(JSON.stringify(source.blocks)) : null,
    design: source.design ? JSON.parse(JSON.stringify(source.design)) : null,
    previewText: source.previewText || null,
    steps: source.steps ? JSON.parse(JSON.stringify(source.steps)) : [],
    status: 'draft',
    stats: { enrolled: 0, sent: 0, failed: 0, unsubscribed: 0 },
    createdByUserId: user.id,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
  }

  store.marketingCampaigns = store.marketingCampaigns || []
  store.marketingCampaigns.push(campaign)
  return campaign
}
