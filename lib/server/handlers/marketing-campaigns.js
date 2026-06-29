import { requireUser } from '../auth.js'
import { readStore, updateStore, updateStorePartial, createId } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  enrichMarketingRows,
  filterMarketingCampaignsVisible,
  filterMarketingRows,
  getUserOrg,
  marketingScopeKey,
  requireMarketingUser,
} from '../marketingAccess.js'
import { getUserCrmGmail } from '../crmUserGmail.js'
import { canOfferCustomerGmailConnect } from '../config.js'
import { isResendConfigured } from '../email.js'
import { userCanSendOnOrgDomain } from '../orgEmailDomain.js'
import { buildOrgUserResponse } from '../organizations.js'
import { executeCampaignSendByMode } from '../email/dualModeSend.js'
import { EMAIL_SEND_MODE, INLINE_EMAIL_MAX_RECIPIENTS } from '../email/sendMode.js'
import { marketingSqlQueueActive, enqueueMarketingCampaignBatch } from '../marketingEmailQueue.js'
import { triggerMarketingQueueWorker } from '../marketingQueueTrigger.js'
import { checkEmailWorkerReady, isWorkerOnlyEmailRequired } from '../infra/emailWorkerPolicy.js'
import {
  countPendingCampaignSends,
  countQueuedCampaignEnrollments,
  archiveMarketingCampaign,
  enrollCampaign,
  getMarketingCampaign,
  getMarketingList,
  getMarketingTemplate,
  resolveCampaignAudience,
  sendCampaignTestEmails,
  MARKETING_SEND_CHUNK,
  MARKETING_SEND_META_SLICES,
  marketingOverview,
  normalizeCampaignSteps,
  pauseMarketingCampaign,
  processCampaignSendBurst,
  processDueEnrollments,
  resumeMarketingCampaign,
  resolveCampaignContent,
  resolveCampaignSender,
  stopMarketingCampaign,
} from '../marketingCampaigns.js'
import { enrichMarketingFormBlocks } from '../../marketingFormSchema.js'
import { blocksToPlainText } from '../marketingEmailDesign.js'
import { buildCampaignReport, duplicateMarketingCampaign } from '../marketingCampaignReport.js'
import { logWhatsAppCampaignSend, refreshWhatsAppEnrollmentMessages } from '../marketingWhatsApp.js'
import { isWhatsAppCloudConfigured } from '../whatsappCloud.js'
import { loadPipelineStoreContext, loadPipelineStoreForLeadIds } from '../pipelineShard.js'
import { mergeCampaignStatsShards, readCampaignStatsShard } from '../marketingCampaignStatsShard.js'
import { readCampaignSendShard, writeCampaignSendShard } from '../marketingCampaignSendShard.js'
import { writeCampaignEnrollments } from '../marketingEnrollmentShard.js'
import {
  canSendMarketingCampaign,
  resolveMarketingPermissions,
} from '../marketingRoles.js'
import {
  reviewCampaignApproval,
  submitCampaignForApproval,
} from '../marketingApproval.js'

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
    'marketingSegments',
    'marketingTemplates',
    'marketingSuppressions',
    'marketingForms',
    'marketingEvents',
    'users',
    'organizations',
    'organizationMemberships',
  ]

  const MARKETING_USER_SLICES = ['users', 'organizations', 'organizationMemberships']

  async function marketingUser(extraSlices = MARKETING_USER_SLICES) {
    const slices = [...new Set([...MARKETING_USER_SLICES, ...extraSlices])]
    const sliceStore = await readStore({ only: slices })
    const dbUser = sliceStore.users.find((u) => u.id === sessionUser.id)
    return {
      user: buildOrgUserResponse(dbUser || sessionUser, sliceStore),
      store: sliceStore,
    }
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    if (body.action === 'process_sends') {
      if (isWorkerOnlyEmailRequired()) {
        return sendJson(res, 403, {
          error: 'Browser send drain is disabled (Email V3). Workers process campaigns in the background.',
          code: 'BROWSER_DRAIN_DISABLED',
        })
      }
      const { user: sendUser } = await marketingUser()
      return processCampaignSends(res, sendUser, body.id || body.campaignId, body.limit, {
        burst: body.burst !== false,
      })
    }
    if (body.action === 'start') {
      const { user: startUser } = await marketingUser(MARKETING_START_SLICES)
      return startCampaign(res, startUser, body.id, { scheduledAt: body.scheduledAt })
    }
    if (body.action === 'test_send') {
      const { user: testUser, store: testStore } = await marketingUser([
        ...MARKETING_START_SLICES,
        'marketingTemplates',
      ])
      const campaign = getMarketingCampaign(testStore, testUser, body.id, { manage: true })
      if (!campaign) return sendJson(res, 404, { error: 'Campaign not found' })
      try {
        const result = await sendCampaignTestEmails(testStore, testUser, campaign, {
          emails: body.emails || [testUser.email],
        })
        const refreshed = getMarketingCampaign(
          await readStore({ only: ['marketingCampaigns'] }),
          testUser,
          body.id,
          { manage: true }
        )
        return sendJson(res, 200, { ...result, campaign: refreshed })
      } catch (e) {
        return sendJson(res, 400, { error: e.message || 'Test send failed' })
      }
    }
    if (body.action === 'submit_approval') {
      const { user: apprUser, store: apprStore } = await marketingUser(['marketingCampaigns'])
      try {
        const result = await submitCampaignForApproval(apprStore, apprUser, body.id)
        return sendJson(res, 200, result)
      } catch (e) {
        return sendJson(res, 400, { error: e.message || 'Could not submit for approval' })
      }
    }
    if (body.action === 'approve' || body.action === 'reject') {
      const { user: revUser, store: revStore } = await marketingUser(['marketingCampaigns'])
      try {
        const result = await reviewCampaignApproval(revStore, revUser, body.id, {
          approve: body.action === 'approve',
          comment: body.comment,
        })
        return sendJson(res, 200, result)
      } catch (e) {
        return sendJson(res, 400, { error: e.message || 'Review failed' })
      }
    }
  }

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
      try {
        return sendJson(res, 200, {
          ...(await marketingOverview(overviewStore, user, { light })),
        })
      } catch (e) {
        console.error('marketing overview failed:', e?.message || e)
        return sendJson(res, 503, {
          error: 'Marketing data is temporarily unavailable. Please retry in a moment.',
        })
      }
    }
    const campaignId = String(req.query?.campaignId || '').trim()
    const recipientFilter = String(req.query?.recipientFilter || '').trim()
    if (campaignId && recipientFilter) {
      const { resolveCampaignRecipientLeadIds } = await import('../marketingCampaignLeadIds.js')
      const result = await resolveCampaignRecipientLeadIds(store, user, campaignId, recipientFilter)
      if (!result.campaignName && result.count === 0) {
        const campaign = getMarketingCampaign(store, user, campaignId)
        if (!campaign) return sendJson(res, 404, { error: 'Campaign not found' })
      }
      return sendJson(res, 200, result)
    }
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
    const campaigns = await mergeCampaignStatsShards(
      enrichMarketingRows(
        store,
        user,
        filterMarketingCampaignsVisible(store.marketingCampaigns, user).sort(
          (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
        )
      )
    )
    return sendJson(res, 200, { campaigns, enrollments: [] })
  }

  if (req.method === 'POST') {
    const body = getBody(req)
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
      segmentId,
      templateId,
      type,
      channel,
      subject,
      body: emailBody,
      steps,
      blocks,
      design,
      previewText,
      scheduledAt,
      sendMode,
      recurrence,
      recurrenceMaxRuns,
      abTest,
      campaignType,
      emailProvider,
    } = body
    const campaignChannel = channel === 'whatsapp' ? 'whatsapp' : 'email'
    if (!String(name || '').trim()) return sendJson(res, 400, { error: 'Campaign name is required' })
    if (!listId && !segmentId) {
      return sendJson(res, 400, { error: 'listId or segmentId is required' })
    }

    let audienceChannel = campaignChannel
    if (listId) {
      const list = getMarketingList(store, user, listId)
      if (!list) return sendJson(res, 404, { error: 'List not found' })
      audienceChannel = list.channel || 'email'
    } else if (segmentId) {
      const { getMarketingSegment } = await import('../marketingSegments.js')
      const segment = getMarketingSegment(store, user, segmentId)
      if (!segment) return sendJson(res, 404, { error: 'Segment not found' })
      audienceChannel = segment.channel || 'email'
    }

    if (audienceChannel !== campaignChannel) {
      return sendJson(res, 400, {
        error:
          campaignChannel === 'whatsapp'
            ? 'Choose a WhatsApp audience for this campaign.'
            : 'Choose an email audience for this campaign.',
      })
    }

    const template = getMarketingTemplate(store, user, templateId)
    const marketingForms = filterMarketingRows(store.marketingForms || [], user)
    const enrichedBlocks = blocks?.length ? enrichMarketingFormBlocks(blocks, marketingForms) : blocks
    const enrichedSteps = Array.isArray(steps)
      ? steps.map((step) =>
          step?.blocks?.length
            ? { ...step, blocks: enrichMarketingFormBlocks(step.blocks, marketingForms) }
            : step
        )
      : steps
    const resolved = resolveCampaignContent(
      {
        subject,
        body: emailBody,
        steps: enrichedSteps,
        blocks: enrichedBlocks,
        design,
        previewText,
      },
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
      listId: listId || null,
      segmentId: segmentId || null,
      templateId: template?.id || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      sendMode: sendMode === 'scheduled' || scheduledAt ? 'scheduled' : 'immediate',
      recurrence: ['daily', 'weekly', 'monthly'].includes(recurrence) ? recurrence : null,
      recurrenceMaxRuns: Math.min(365, Math.max(1, Number(recurrenceMaxRuns) || 52)),
      campaignType: campaignType || 'regular',
      abTest: abTest?.enabled ? abTest : null,
      emailProvider: ['auto', 'resend', 'gmail', 'ses', 'sendgrid'].includes(emailProvider)
        ? emailProvider
        : null,
      approvalStatus: null,
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
      const campaignId = body.id || body.campaignId
      if (!campaignId) return sendJson(res, 400, { error: 'Campaign id is required' })
      try {
        const campaign = await pauseMarketingCampaign(user, campaignId)
        return sendJson(res, 200, { campaign })
      } catch (e) {
        const msg = e.message || 'Could not pause campaign'
        return sendJson(res, msg === 'Campaign not found' ? 404 : 400, { error: msg })
      }
    }
    if (body.action === 'resume') {
      const campaignId = body.id || body.campaignId
      if (!campaignId) return sendJson(res, 400, { error: 'Campaign id is required' })
      try {
        await resumeMarketingCampaign(user, campaignId)
        const burst = await processCampaignSendBurst(user, campaignId, {
          limit: body.limit,
        })
        return sendJson(res, 200, {
          campaign: burst.campaign,
          sendResult: burst,
          pendingSends: burst.pendingSends,
          queuedSends: burst.queuedSends,
          firstError: burst.firstError || null,
        })
      } catch (e) {
        const msg = e.message || 'Could not resume campaign'
        return sendJson(res, msg === 'Campaign not found' ? 404 : 400, { error: msg })
      }
    }
    if (body.action === 'stop') {
      const campaignId = body.id || body.campaignId
      if (!campaignId) return sendJson(res, 400, { error: 'Campaign id is required' })
      try {
        const campaign = await stopMarketingCampaign(user, campaignId)
        return sendJson(res, 200, { campaign })
      } catch (e) {
        const msg = e.message || 'Could not stop campaign'
        return sendJson(res, msg === 'Campaign not found' ? 404 : 400, { error: msg })
      }
    }
    if (body.action === 'archive') {
      const campaignId = body.id || body.campaignId
      if (!campaignId) return sendJson(res, 400, { error: 'Campaign id is required' })
      try {
        const campaign = await archiveMarketingCampaign(user, campaignId)
        return sendJson(res, 200, { campaign })
      } catch (e) {
        const msg = e.message || 'Could not archive campaign'
        const code = msg === 'Campaign not found' ? 404 : 400
        return sendJson(res, code, { error: msg })
      }
    }

    const {
      id,
      name,
      listId,
      segmentId,
      templateId,
      subject,
      body: emailBody,
      steps,
      blocks,
      design,
      previewText,
      scheduledAt,
      sendMode,
      recurrence,
      abTest,
      emailProvider,
    } = body
    const existing = getMarketingCampaign(store, user, id, { manage: true })
    if (!existing) return sendJson(res, 404, { error: 'Campaign not found' })
    if (existing.status !== 'draft' && existing.status !== 'scheduled') {
      return sendJson(res, 400, { error: 'Only draft or scheduled campaigns can be edited' })
    }

    await updateStore((draft) => {
      const row = draft.marketingCampaigns.find((c) => c.id === id)
      if (!row) return draft
      if (name !== undefined) row.name = String(name).trim().slice(0, 120)
      if (listId !== undefined) row.listId = listId || null
      if (segmentId !== undefined) row.segmentId = segmentId || null
      if (templateId !== undefined) row.templateId = templateId || null
      if (subject !== undefined) row.subject = String(subject).trim().slice(0, 500)
      if (emailBody !== undefined) row.body = String(emailBody).trim().slice(0, 12000)
      if (blocks !== undefined) row.blocks = blocks
      if (design !== undefined) row.design = design
      if (previewText !== undefined) row.previewText = previewText
      if (steps !== undefined) {
        row.steps = normalizeCampaignSteps(steps, row.subject, row.body)
        row.type = row.steps.length > 1 ? 'sequence' : 'one_shot'
      }
      if (scheduledAt !== undefined) {
        row.scheduledAt = scheduledAt ? new Date(scheduledAt).toISOString() : null
      }
      if (sendMode !== undefined) row.sendMode = sendMode
      if (recurrence !== undefined) {
        row.recurrence = ['daily', 'weekly', 'monthly'].includes(recurrence) ? recurrence : null
      }
      if (abTest !== undefined) {
        row.abTest = abTest?.enabled ? abTest : null
      }
      if (emailProvider !== undefined) {
        row.emailProvider = ['auto', 'resend', 'gmail', 'ses', 'sendgrid'].includes(emailProvider)
          ? emailProvider
          : row.emailProvider
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
    const body = getBody(req)
    const id = body.id
    const permanent = Boolean(body.permanent)
    const existing = getMarketingCampaign(store, user, id, { manage: true })
    if (!existing) return sendJson(res, 404, { error: 'Campaign not found' })
    if (!permanent) {
      try {
        const campaign = await archiveMarketingCampaign(user, id)
        return sendJson(res, 200, { ok: true, archived: true, campaign })
      } catch (e) {
        return sendJson(res, 400, { error: e.message || 'Could not archive campaign' })
      }
    }
    if (existing.status !== 'archived') {
      return sendJson(res, 400, {
        error: 'Move the campaign to Archive first, then delete permanently from Archive.',
      })
    }
    await updateStorePartial(['marketingCampaigns'], (draft) => {
      draft.marketingCampaigns = (draft.marketingCampaigns || []).filter((c) => c.id !== id)
      return draft
    })
    await writeCampaignEnrollments(id, [])
    return sendJson(res, 200, { ok: true, permanent: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}

const MARKETING_START_SLICES = [
  'marketingCampaigns',
  'marketingLists',
  'marketingSegments',
  'marketingTemplates',
  'marketingSuppressions',
  'users',
  'organizations',
  'organizationMemberships',
]

async function startCampaign(res, user, campaignId, { scheduledAt: overrideSchedule } = {}) {
  const listSlices = [
    'marketingLists',
    'marketingSuppressions',
    ...MARKETING_SEND_META_SLICES,
  ]
  const [sendShard, listStore] = await Promise.all([
    readCampaignSendShard(campaignId),
    readStore({ only: listSlices }),
  ])

  let campaign = sendShard
  if (!campaign) {
    const withCampaigns = await readStore({
      only: ['marketingCampaigns', ...listSlices],
    })
    campaign = getMarketingCampaign(withCampaigns, user, campaignId, { manage: true })
    if (!campaign) return sendJson(res, 404, { error: 'Campaign not found' })
    Object.assign(listStore, { marketingCampaigns: withCampaigns.marketingCampaigns })
  }

  const baseStore = { ...listStore, marketingCampaigns: campaign ? [campaign] : [] }
  if (campaign.status === 'active') {
    return sendJson(res, 400, { error: 'Campaign is already running' })
  }
  if (campaign.status === 'completed') {
    return sendJson(res, 400, { error: 'Campaign already completed' })
  }

  const perms = resolveMarketingPermissions(user, baseStore)
  if (!canSendMarketingCampaign(user, baseStore, campaign)) {
    if (perms.requiresApprovalToSend && campaign.approvalStatus !== 'pending') {
      try {
        await submitCampaignForApproval(baseStore, user, campaignId)
        return sendJson(res, 200, {
          campaign: { ...campaign, approvalStatus: 'pending' },
          submittedForApproval: true,
          message: 'Campaign submitted for manager approval.',
        })
      } catch (e) {
        return sendJson(res, 400, { error: e.message || 'Approval required before sending' })
      }
    }
    return sendJson(res, 403, {
      error:
        campaign.approvalStatus === 'pending'
          ? 'Campaign is pending approval'
          : 'You do not have permission to send campaigns',
    })
  }

  const scheduleAt = overrideSchedule || campaign.scheduledAt
  if (scheduleAt && new Date(scheduleAt).getTime() > Date.now()) {
    const iso = new Date(scheduleAt).toISOString()
    await updateStorePartial(['marketingCampaigns'], (draft) => {
      const row = (draft.marketingCampaigns || []).find((c) => c.id === campaignId)
      if (row) {
        row.status = 'scheduled'
        row.scheduledAt = iso
        row.sendMode = 'scheduled'
        row.updatedAt = new Date().toISOString()
      }
      return draft
    })
    return sendJson(res, 200, {
      campaign: { ...campaign, status: 'scheduled', scheduledAt: iso },
      scheduled: true,
      message: `Campaign scheduled for ${iso}`,
    })
  }

  const audience = await resolveCampaignAudience(baseStore, user, campaign)
  if (!audience?.leadIds?.length) {
    return sendJson(res, 400, { error: 'Audience has no leads' })
  }

  const listChannel = audience.channel || 'email'
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
    const org = getUserOrg(baseStore, sender)
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

  const { pipelineStore } = await loadPipelineStoreForLeadIds(user, audience.leadIds)
  const store = { ...baseStore, savedLeads: pipelineStore.savedLeads }
  const enrolled = await enrollCampaign(store, user, campaign, audience)
  const startedAt = new Date().toISOString()
  const { syncMarketingCampaignStatus } = await import('../marketingCampaigns.js')
  await syncMarketingCampaignStatus(user, campaignId, { status: 'active', startedAt })
  await writeCampaignSendShard(store, user, { ...campaign, status: 'active', startedAt })
  if (!enrolled) {
    return sendJson(res, 400, {
      error:
        campaign.channel === 'whatsapp'
          ? 'No eligible leads with a valid phone number on file'
          : 'No eligible leads (need a valid email, commercial consent, and not unsubscribed)',
    })
  }

  const stats = await readCampaignStatsShard(campaignId)
  const pendingSends =
    campaign.channel === 'email' ? enrolled : await countPendingCampaignEnrollments(campaignId)
  const queuedSends = await countQueuedCampaignEnrollments(campaignId)
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

  let modeResult = null
  if (campaign.channel === 'email' && pendingSends > 0) {
    if (pendingSends <= INLINE_EMAIL_MAX_RECIPIENTS) {
      modeResult = await executeCampaignSendByMode(user, campaignId, pendingSends, {
        source: 'marketing',
      })
    } else if (marketingSqlQueueActive()) {
      const { readCampaignEnrollments } = await import('../marketingEnrollmentShard.js')
      const enrollmentRows = await readCampaignEnrollments(campaignId)
      const enrollmentsByLeadId = Object.fromEntries(
        enrollmentRows.map((row) => [row.leadId, row])
      )
      const queueResult = await enqueueMarketingCampaignBatch({
        user,
        campaign,
        leadIds: audience.leadIds,
        enrollmentsByLeadId,
        suppressions: listStore.marketingSuppressions || [],
      })
      const enqueued = queueResult.enqueued ?? 0
      let drainResult = { sent: 0, failed: 0, skipped: 0, firstError: null }
      if (enqueued > 0) {
        const { processMarketingEmailQueue } = await import('../marketingEmailQueueWorker.js')
        drainResult = await processMarketingEmailQueue({
          limit: Math.min(enqueued, 30),
          maxMs: 115_000,
        })
        const remaining = Math.max(
          0,
          enqueued - (drainResult.sent || 0) - (drainResult.failed || 0) - (drainResult.skipped || 0)
        )
        if (remaining > 0) {
          triggerMarketingQueueWorker({ afterMs: 2_000, limit: 50 })
        }
      } else {
        modeResult = await executeCampaignSendByMode(
          user,
          campaignId,
          Math.min(pendingSends, INLINE_EMAIL_MAX_RECIPIENTS),
          { source: 'marketing' }
        )
      }
      if (!modeResult) {
        const remaining = Math.max(
          0,
          enqueued - (drainResult.sent || 0) - (drainResult.failed || 0) - (drainResult.skipped || 0)
        )
        const sentNow = drainResult.sent ?? 0
        modeResult = {
          mode: EMAIL_SEND_MODE.SQL_QUEUE,
          campaignId,
          sent: sentNow,
          failed: drainResult.failed ?? 0,
          firstError: drainResult.firstError ?? null,
          pendingSends: remaining,
          queuedSends: remaining,
          done: remaining <= 0,
          background: remaining > 0,
          backgroundJobId: queueResult.batchId || null,
          sendStatus:
            remaining <= 0 && sentNow > 0
              ? 'completed'
              : sentNow > 0
                ? 'sending'
                : enqueued > 0
                  ? 'sending'
                  : 'failed',
          workerOnline: false,
          workerHint:
            sentNow > 0 && remaining > 0
              ? `Sent ${sentNow} immediately — ${remaining} still sending in the background.`
              : sentNow > 0
                ? `Campaign sent — ${sentNow} delivered.`
                : enqueued > 0
                  ? 'Processing queued sends — refresh in a minute if counts do not update.'
                  : 'No recipients could be queued. Check commercial email consent on your leads.',
        }
      }
    } else {
      modeResult = await executeCampaignSendByMode(user, campaignId, pendingSends, {
        source: 'marketing',
      })
    }
  }

  const pendingAfter = modeResult?.pendingSends ?? pendingSends
  const sendStatus = modeResult?.sendStatus ?? (pendingAfter > 0 ? 'queued' : 'completed')

  return sendJson(res, 200, {
    campaign: updated,
    enrolled,
    pendingSends: pendingAfter,
    queuedSends: modeResult?.queuedSends ?? pendingAfter,
    mode: modeResult?.mode ?? null,
    sent: modeResult?.sent ?? 0,
    failed: modeResult?.failed ?? 0,
    sendResult: modeResult
      ? {
          sent: modeResult.sent,
          failed: modeResult.failed,
          firstError: modeResult.firstError,
          pendingSends: pendingAfter,
        }
      : { sent: 0, failed: 0, processed: 0, firstError: null },
    firstError: modeResult?.firstError || null,
    workerHint: modeResult?.workerHint || null,
    queued:
      campaign.channel === 'email' &&
      (modeResult?.mode === EMAIL_SEND_MODE.QUEUED ||
        modeResult?.mode === EMAIL_SEND_MODE.SQL_QUEUE),
    background: Boolean(modeResult?.background),
    sendStatus,
    backgroundJobId: modeResult?.backgroundJobId || null,
  })
}

async function processCampaignSends(res, user, campaignId, limitRaw, { burst = true } = {}) {
  const campaign = getMarketingCampaign(
    await readStore({ only: ['marketingCampaigns'] }),
    user,
    campaignId,
    { manage: true }
  )
  if (!campaign) return sendJson(res, 404, { error: 'Campaign not found' })
  if (campaign.status !== 'active') {
    return sendJson(res, 400, { error: 'Campaign is not active' })
  }

  if (burst !== false) {
    const sendResult = await processCampaignSendBurst(user, campaignId, { limit: limitRaw })
    return sendJson(res, 200, {
      campaign: sendResult.campaign,
      sendResult,
      pendingSends: sendResult.pendingSends,
      queuedSends: sendResult.queuedSends,
      firstError: sendResult.firstError || null,
    })
  }

  const limit = Math.min(Math.max(Number(limitRaw) || MARKETING_SEND_CHUNK, 1), MARKETING_SEND_CHUNK)
  const metaStore = await readStore({ only: MARKETING_SEND_META_SLICES })
  const sender =
    resolveCampaignSender({ ...metaStore, marketingCampaigns: [campaign] }, campaign) || user
  const sendResult = await processDueEnrollments({ campaignId, limit, actorUser: sender })
  const pendingSends = await countPendingCampaignSends(campaignId)
  const stats = (await readCampaignStatsShard(campaignId)) || {}
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
