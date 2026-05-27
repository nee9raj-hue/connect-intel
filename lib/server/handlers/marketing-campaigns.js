import { requireUser } from '../auth.js'
import { readStore, updateStore, createId } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  enrichMarketingRows,
  filterMarketingRows,
  marketingScopeKey,
  requireMarketingUser,
} from '../marketingAccess.js'
import { getUserCrmGmail } from '../crmUserGmail.js'
import { canOfferCustomerGmailConnect } from '../config.js'
import { isResendConfigured } from '../email.js'
import { getUserOrg } from '../marketingAccess.js'
import { userCanSendOnOrgDomain } from '../orgEmailDomain.js'
import { buildOrgUserResponse } from '../organizations.js'
import {
  countPendingCampaignSends,
  enrollCampaign,
  getMarketingCampaign,
  getMarketingList,
  getMarketingTemplate,
  MARKETING_SEND_CHUNK,
  MARKETING_SEND_META_SLICES,
  marketingOverview,
  normalizeCampaignSteps,
  processDueEnrollments,
  resolveCampaignContent,
  resolveCampaignSender,
} from '../marketingCampaigns.js'
import { blocksToPlainText } from '../marketingEmailDesign.js'
import { buildCampaignReport, duplicateMarketingCampaign } from '../marketingCampaignReport.js'
import { logWhatsAppCampaignSend, refreshWhatsAppEnrollmentMessages } from '../marketingWhatsApp.js'
import { isWhatsAppCloudConfigured } from '../whatsappCloud.js'
import { loadPipelineStoreContext, loadPipelineStoreForLeadIds } from '../pipelineShard.js'
import { mergeCampaignStatsShards, readCampaignStatsShard } from '../marketingCampaignStatsShard.js'
import { writeCampaignSendShard } from '../marketingCampaignSendShard.js'
import { writeCampaignEnrollments } from '../marketingEnrollmentShard.js'

function enrichCampaignSteps(steps) {
  return (steps || []).map((step) => ({
    ...step,
    body: step.body || (step.blocks?.length ? blocksToPlainText(step.blocks) : ''),
  }))
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  const MARKETING_READ_SLICES = [
    'marketingCampaigns',
    'marketingLists',
    'marketingTemplates',
    'marketingSuppressions',
    'marketingForms',
    'marketingEvents',
    'users',
    'organizations',
    'organizationMemberships',
  ]

  const store = await readStore({ only: MARKETING_READ_SLICES })
  const dbUser = store.users.find((u) => u.id === sessionUser.id)
  const user = buildOrgUserResponse(dbUser || sessionUser, store)

  if (req.method === 'GET') {
    if (req.query?.overview === '1') {
      const light = req.query?.light === '1'
      let overviewStore = store
      if (!light) {
        const { pipelineStore } = await loadPipelineStoreContext(user)
        overviewStore = { ...store, savedLeads: pipelineStore.savedLeads }
      }
      return sendJson(res, 200, {
        ...(await marketingOverview(overviewStore, user, { light })),
      })
    }
    const campaignId = String(req.query?.campaignId || '').trim()
    if (campaignId) {
      const { pipelineStore } = await loadPipelineStoreContext(user)
      const reportStore = { ...store, savedLeads: pipelineStore.savedLeads }
      const { readCampaignEnrollments } = await import('../marketingEnrollmentShard.js')
      const report = buildCampaignReport(
        reportStore,
        user,
        campaignId,
        await readCampaignEnrollments(campaignId)
      )
      if (!report) return sendJson(res, 404, { error: 'Campaign not found' })
      return sendJson(res, 200, report)
    }
    const campaigns = enrichMarketingRows(
      store,
      user,
      filterMarketingRows(store.marketingCampaigns, user).sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      )
    )
    return sendJson(res, 200, { campaigns, enrollments: [] })
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    if (body.action === 'start') {
      return startCampaign(res, user, body.id)
    }
    if (body.action === 'process_sends') {
      return processCampaignSends(res, user, body.id || body.campaignId, body.limit)
    }
    if (body.action === 'log_whatsapp_sent') {
      const enrollmentId = body.enrollmentId || body.id
      if (!enrollmentId) return sendJson(res, 400, { error: 'enrollmentId is required' })
      try {
        const result = await logWhatsAppCampaignSend(user, enrollmentId)
        return sendJson(res, 200, result)
      } catch (e) {
        return sendJson(res, 400, { error: e.message || 'Could not log WhatsApp send' })
      }
    }
    if (body.action === 'duplicate') {
      const sourceId = body.id || body.campaignId
      if (!sourceId) return sendJson(res, 400, { error: 'Campaign id is required' })
      let created = null
      try {
        await updateStore((draft) => {
          created = duplicateMarketingCampaign(draft, user, sourceId)
          if (!created) throw new Error('Campaign not found')
          return draft
        })
      } catch (e) {
        return sendJson(res, 404, { error: e.message || 'Campaign not found' })
      }
      return sendJson(res, 201, { campaign: created })
    }

    const {
      name,
      listId,
      templateId,
      type,
      channel,
      subject,
      body: emailBody,
      steps,
      blocks,
      design,
      previewText,
    } = body
    const campaignChannel = channel === 'whatsapp' ? 'whatsapp' : 'email'
    if (!String(name || '').trim()) return sendJson(res, 400, { error: 'Campaign name is required' })
    if (!listId) return sendJson(res, 400, { error: 'listId is required' })

    const list = getMarketingList(store, user, listId)
    if (!list) return sendJson(res, 404, { error: 'List not found' })
    const listChannel = list.channel || 'email'
    if (listChannel !== campaignChannel) {
      return sendJson(res, 400, {
        error:
          campaignChannel === 'whatsapp'
            ? 'Choose a WhatsApp list for this campaign (create one under Marketing → Lists).'
            : 'Choose an email list for this campaign (create one under Marketing → Lists).',
      })
    }

    const template = getMarketingTemplate(store, user, templateId)
    const resolved = resolveCampaignContent(
      { subject, body: emailBody, steps, blocks, design, previewText },
      template
    )
    const firstStep = resolved.steps[0]
    if (!firstStep?.body && !firstStep?.blocks?.length) {
      return sendJson(res, 400, { error: 'Message content is required' })
    }
    if (campaignChannel === 'email' && !firstStep?.subject) {
      return sendJson(res, 400, { error: 'Email subject is required' })
    }

    const now = new Date().toISOString()
    const campaign = {
      id: createId('mcamp'),
      ...marketingScopeKey(user),
      name: String(name).trim().slice(0, 120),
      type: type === 'sequence' ? 'sequence' : 'one_shot',
      channel: campaignChannel,
      listId,
      templateId: template?.id || null,
      subject: resolved.subject,
      body: resolved.body,
      blocks: resolved.blocks || null,
      design: resolved.design || null,
      previewText: resolved.previewText || null,
      steps: enrichCampaignSteps(resolved.steps),
      status: 'draft',
      stats: { enrolled: 0, sent: 0, failed: 0, unsubscribed: 0 },
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    }

    await updateStore((draft) => {
      draft.marketingCampaigns = draft.marketingCampaigns || []
      draft.marketingCampaigns.push(campaign)
      return draft
    })
    await writeCampaignSendShard(store, user, campaign)
    return sendJson(res, 201, { campaign })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    if (body.action === 'start') {
      return startCampaign(res, user, body.id)
    }
    if (body.action === 'pause') {
      return pauseCampaign(res, user, body.id)
    }

    const { id, name, listId, templateId, subject, body: emailBody, steps } = body
    const existing = getMarketingCampaign(store, user, id)
    if (!existing) return sendJson(res, 404, { error: 'Campaign not found' })
    if (existing.status !== 'draft') {
      return sendJson(res, 400, { error: 'Only draft campaigns can be edited' })
    }

    await updateStore((draft) => {
      const row = draft.marketingCampaigns.find((c) => c.id === id)
      if (!row) return draft
      if (name !== undefined) row.name = String(name).trim().slice(0, 120)
      if (listId !== undefined) row.listId = listId
      if (templateId !== undefined) row.templateId = templateId || null
      if (subject !== undefined) row.subject = String(subject).trim().slice(0, 500)
      if (emailBody !== undefined) row.body = String(emailBody).trim().slice(0, 12000)
      if (steps !== undefined) {
        row.steps = normalizeCampaignSteps(steps, row.subject, row.body)
        row.type = row.steps.length > 1 ? 'sequence' : 'one_shot'
      }
      row.updatedAt = new Date().toISOString()
      return draft
    })
    const updatedStore = await readStore({ only: ['marketingCampaigns', 'marketingTemplates'] })
    const updated = getMarketingCampaign(updatedStore, user, id)
    if (updated) await writeCampaignSendShard(updatedStore, user, updated)
    return sendJson(res, 200, { campaign: updated })
  }

  if (req.method === 'DELETE') {
    const id = getBody(req).id
    const existing = getMarketingCampaign(store, user, id)
    if (!existing) return sendJson(res, 404, { error: 'Campaign not found' })
    if (existing.status === 'active') {
      return sendJson(res, 400, { error: 'Pause the campaign before deleting' })
    }
    await updateStorePartial(['marketingCampaigns'], (draft) => {
      draft.marketingCampaigns = (draft.marketingCampaigns || []).filter((c) => c.id !== id)
      return draft
    })
    await writeCampaignEnrollments(id, [])
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}

const MARKETING_START_SLICES = [
  'marketingCampaigns',
  'marketingLists',
  'marketingTemplates',
  'marketingSuppressions',
  'users',
  'organizations',
  'organizationMemberships',
]

async function startCampaign(res, user, campaignId) {
  const baseStore = await readStore({ only: MARKETING_START_SLICES })
  const campaign = getMarketingCampaign(baseStore, user, campaignId)
  if (!campaign) return sendJson(res, 404, { error: 'Campaign not found' })
  if (campaign.status === 'active') {
    return sendJson(res, 400, { error: 'Campaign is already running' })
  }
  if (campaign.status === 'completed') {
    return sendJson(res, 400, { error: 'Campaign already completed' })
  }

  const list = getMarketingList(baseStore, user, campaign.listId)
  if (!list?.leadIds?.length) {
    return sendJson(res, 400, { error: 'List has no leads' })
  }

  const listChannel = list.channel || 'email'
  const campaignChannel = campaign.channel || 'email'
  if (listChannel !== campaignChannel) {
    return sendJson(res, 400, {
      error:
        campaignChannel === 'whatsapp'
          ? 'This campaign needs a WhatsApp list. Create one under Marketing → Lists with channel WhatsApp.'
          : 'This campaign needs an email list. Create one under Marketing → Lists with channel Email.',
    })
  }

  if (campaign.channel === 'email') {
    const sender =
      resolveCampaignSender(baseStore, campaign) ||
      buildOrgUserResponse(baseStore.users.find((u) => u.id === user.id) || user, baseStore)
    const org = getUserOrg(store, sender)
    const gmail = getUserCrmGmail(sender)
    const orgCanSend = isResendConfigured() && org && userCanSendOnOrgDomain(sender, org).canSend
    if (!gmail && !orgCanSend) {
      const check = org ? userCanSendOnOrgDomain(sender, org) : null
      const domain = org?.emailDomain?.name
      let error =
        check?.hint ||
        (canOfferCustomerGmailConnect()
          ? 'Connect your work Gmail under Work email in the sidebar, then start the campaign.'
          : 'Connect Intel is completing Google app verification — work Gmail connect will work for all users when approved (no DNS).')
      if (!canOfferCustomerGmailConnect() && !domain) {
        error =
          'Email campaigns will unlock when Google approves Connect Intel. Then sign in and connect work Gmail in one click.'
      } else if (!domain && canOfferCustomerGmailConnect()) {
        error = 'Connect your work Gmail under Work email in the sidebar, then start the campaign.'
      } else if (domain && check?.reason === 'email_domain_mismatch') {
        error = check.hint
      } else if (domain && org?.emailDomain?.status !== 'verified') {
        error = `Company domain @${domain} is not verified yet. Ask your admin to finish DNS setup.`
      }
      return sendJson(res, 400, {
        error,
        needsGmailConnect: !gmail,
        needsOrgEmailSetup: !domain,
        googleVerificationBlocked: true,
      })
    }
  }

  const { pipelineStore } = await loadPipelineStoreForLeadIds(user, list.leadIds)
  const store = { ...baseStore, savedLeads: pipelineStore.savedLeads }
  await writeCampaignSendShard(store, user, campaign)
  const enrolled = await enrollCampaign(store, user, campaign, list)
  if (!enrolled) {
    return sendJson(res, 400, {
      error:
        campaign.channel === 'whatsapp'
          ? 'No eligible leads with a valid phone number on file'
          : 'No eligible leads (need email on file and not unsubscribed)',
    })
  }

  const stats = await readCampaignStatsShard(campaignId)
  const pendingSends =
    campaign.channel === 'email' ? enrolled : await countPendingCampaignEnrollments(campaignId)
  const updated = {
    ...campaign,
    status: 'active',
    stats: stats || {
      enrolled,
      sent: campaign.stats?.sent || 0,
      failed: campaign.stats?.failed || 0,
      unsubscribed: campaign.stats?.unsubscribed || 0,
    },
  }

  if (campaign.channel === 'whatsapp' && !isWhatsAppCloudConfigured(user, store)) {
    await refreshWhatsAppEnrollmentMessages(store, user, updated, {
      limit: Math.min(enrolled, 5),
    })
  }

  return sendJson(res, 200, {
    campaign: updated,
    enrolled,
    pendingSends,
    sendResult: { sent: 0, failed: 0, processed: 0 },
    queued: campaign.channel === 'email' && pendingSends > 0,
  })
}

async function processCampaignSends(res, user, campaignId, limitRaw) {
  const { readCampaignSendShard } = await import('../marketingCampaignSendShard.js')
  const sendCampaign = await readCampaignSendShard(campaignId)
  const metaStore = await readStore({ only: MARKETING_SEND_META_SLICES })
  let campaign = sendCampaign
  if (!campaign) {
    const withRows = await readStore({
      only: [...MARKETING_SEND_META_SLICES, 'marketingCampaigns'],
    })
    campaign = getMarketingCampaign(withRows, user, campaignId)
  }
  if (!campaign) return sendJson(res, 404, { error: 'Campaign not found' })
  if (campaign.status !== 'active') {
    return sendJson(res, 400, { error: 'Campaign is not active' })
  }
  const sender =
    resolveCampaignSender({ ...metaStore, marketingCampaigns: [campaign] }, campaign) || user
  const limit = Math.min(Math.max(Number(limitRaw) || MARKETING_SEND_CHUNK, 1), 2)
  const sendResult = await processDueEnrollments({ campaignId, limit, actorUser: sender })
  const pendingSends = await countPendingCampaignSends(campaignId)
  const stats = await readCampaignStatsShard(campaignId)
  const updated = {
    ...campaign,
    status: stats?.status || campaign.status,
    stats: stats || campaign.stats,
  }
  return sendJson(res, 200, {
    campaign: updated,
    sendResult,
    pendingSends,
    firstError: sendResult.firstError || null,
  })
}

async function pauseCampaign(res, user, campaignId) {
  const store = await readStore()
  const campaign = getMarketingCampaign(store, user, campaignId)
  if (!campaign) return sendJson(res, 404, { error: 'Campaign not found' })

  await updateStore((draft) => {
    const row = draft.marketingCampaigns.find((c) => c.id === campaignId)
    if (row) {
      row.status = 'paused'
      row.updatedAt = new Date().toISOString()
    }
    for (const e of draft.marketingEnrollments || []) {
      if (e.campaignId === campaignId && e.status === 'active') {
        e.status = 'paused'
        e.updatedAt = new Date().toISOString()
      }
    }
    return draft
  })

  const updated = getMarketingCampaign(await readStore(), user, campaignId)
  return sendJson(res, 200, { campaign: updated })
}
