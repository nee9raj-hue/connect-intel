import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import {
  loadPipelineStoreForLeadIds,
  loadPipelineStoreContext,
  patchPipelineEntriesCrmBatch,
} from '../pipelineShard.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { generateAiEmail } from '../crm.js'
import { buildCrmDraftOptions, requireAgenda } from '../crmEmailPrompt.js'
import { recordOutboundEmail } from '../crmEmailThread.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { getOrganization } from '../organizations.js'
import { getUserCrmGmail } from '../crmUserGmail.js'
import { userCanSendOnOrgDomain } from '../orgEmailDomain.js'
import { isResendConfigured } from '../email.js'
import { parseEmailList } from '../emailList.js'
import { mergeTemplateFields } from '../marketingTemplates.js'
import { marketingScopeKey } from '../marketingAccess.js'
import { sendMarketingMessage } from '../marketingSend.js'
import {
  appendPipelineBulkEnrollments,
  buildPipelineBulkEnrollment,
  bumpPipelineBulkCampaignStats,
  createPipelineBulkCampaign,
  findPipelineBulkCampaign,
  markPipelineBulkEnrollmentSent,
  seedPipelineBulkEnrollments,
} from '../pipelineBulkCampaign.js'
import { leadHasSendableEmail } from '../../leadEmailSendable.js'
import { BULK_EMAIL_MAX, BULK_EMAIL_AI_MAX_PER_REQUEST } from '../../bulkEmailLimits.js'
import {
  bulkSendConcurrency,
  filterRowsPendingSend,
  mapWithConcurrency,
} from '../bulkEmailSend.js'
import { drainPipelineBulkCampaign, queuePipelineBulkCampaign } from '../pipelineBulkQueue.js'
import { EMAIL_SEND_MODE } from '../email/sendMode.js'
import { isWorkerOnlyEmailRequired } from '../infra/emailWorkerPolicy.js'

const MAX_BULK = BULK_EMAIL_MAX

function shapeLeadForBulkResolve(entry) {
  const lead = entry?.lead || entry || {}
  return {
    id: lead.id,
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    company: lead.company || '',
    title: lead.title || '',
    email: lead.email || '',
    emailStatus: lead.emailStatus || '',
    emailBouncedAt: lead.emailBouncedAt || null,
  }
}

async function resolveBulkRecipients(res, user, leadIds) {
  const metaStore = await readStore({
    only: ['users', 'organizations', 'organizationMemberships'],
  })
  const sessionUser = metaStore.users.find((u) => u.id === user.id) || user
  const { pipelineStore } = await loadPipelineStoreForLeadIds(sessionUser, leadIds)
  const storeBefore = { ...metaStore, savedLeads: pipelineStore.savedLeads }

  const leads = []
  const sendableIds = []
  const skipped = []

  for (const leadId of leadIds) {
    const entry = findPipelineEntry(storeBefore, sessionUser, leadId)
    if (!entry) {
      skipped.push({ leadId, reason: 'not_in_pipeline' })
      continue
    }
    const shaped = shapeLeadForBulkResolve(entry)
    leads.push(shaped)
    if (leadHasSendableEmail(shaped)) {
      sendableIds.push(leadId)
    } else {
      skipped.push({ leadId, reason: 'no_email' })
    }
  }

  return sendJson(res, 200, {
    leads,
    sendableIds,
    skipped,
    counts: {
      selected: leadIds.length,
      sendable: sendableIds.length,
      skipped: skipped.length,
    },
  })
}

function fallbackSubject(lead, baseSubject) {
  const trimmed = String(baseSubject || '').trim()
  if (trimmed) return trimmed
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || lead.company
  return name ? `Message for ${name}` : 'Message from your contact'
}

async function processLeadSend({
  leadId,
  lead,
  subject,
  emailBody,
  useAiPerLead,
  options,
  campaign,
  enrollmentByLeadId,
  storeBefore,
  user,
  cc,
  aiGenerated,
}) {
  let subj = subject
  let bodyText = emailBody

  if (useAiPerLead) {
    try {
      const draft = await generateAiEmail(lead, options)
      subj = draft.subject || subj
      bodyText = draft.body || bodyText
    } catch (e) {
      const enrollment = enrollmentByLeadId.get(leadId)
      if (campaign && enrollment) {
        await markPipelineBulkEnrollmentSent(campaign.id, enrollment, { error: e.message })
      }
      return { leadId, ok: false, error: e.message }
    }
  }

  subj = fallbackSubject(lead, subj)
  if (!bodyText?.trim()) {
    const enrollment = enrollmentByLeadId.get(leadId)
    if (campaign && enrollment) {
      await markPipelineBulkEnrollmentSent(campaign.id, enrollment, { error: 'Empty body' })
    }
    return { leadId, ok: false, error: 'Empty subject or body' }
  }

  const merged = mergeTemplateFields({ subject: subj, body: bodyText }, lead)
  subj = merged.subject
  bodyText = merged.body

  const enrollment = enrollmentByLeadId.get(leadId)
  const sendResult = await sendMarketingMessage({
    store: storeBefore,
    user,
    lead,
    leadId,
    subject: subj,
    body: bodyText,
    campaignId: campaign?.id,
    enrollmentId: enrollment?.id,
    stepIndex: 0,
  })

  if (!sendResult.sent) {
    if (campaign && enrollment) {
      await markPipelineBulkEnrollmentSent(campaign.id, enrollment, { error: sendResult.error })
    }
    return { leadId, ok: false, error: sendResult.error || 'Send failed' }
  }

  if (campaign && enrollment) {
    await markPipelineBulkEnrollmentSent(campaign.id, enrollment, { sendResult })
  }

  const sentAt = sendResult.sentAt || new Date().toISOString()
  return {
    leadId,
    ok: true,
    subject: subj,
    crmPatch: {
      leadId,
      updateCrm: (crm) =>
        recordOutboundEmail(
          crm,
          {
            subject: subj.trim(),
            body: bodyText.trim(),
            sentAt,
            cc: cc.length ? cc : undefined,
            aiGenerated: useAiPerLead || aiGenerated,
            fromMailbox: sendResult.mailbox || user.email,
            toEmail: lead.email,
            gmailMessageId: sendResult.logPayload?.gmailMessageId || null,
            provider: sendResult.provider || 'bulk',
            campaignId: campaign?.id || null,
          },
          { userId: user.id, userName: user.name }
        ),
    },
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const body = getBody(req)
  const leadIds = Array.isArray(body.leadIds) ? [...new Set(body.leadIds)] : []

  // Email V3: legacy clients that POST leadIds without action: queue still enqueue in background.
  if (
    isWorkerOnlyEmailRequired() &&
    body.action !== 'resolve' &&
    body.action !== 'drain' &&
    body.action !== 'queue' &&
    leadIds.length
  ) {
    body.action = 'queue'
  }

  if (body.action === 'resolve') {
    if (!leadIds.length) {
      return sendJson(res, 400, { error: 'leadIds array is required' })
    }
    if (leadIds.length > MAX_BULK) {
      return sendJson(res, 400, { error: `Maximum ${MAX_BULK} leads per batch` })
    }
    return resolveBulkRecipients(res, sessionUser, leadIds)
  }

  if (body.action === 'queue' || body.action === 'drain') {
    if (body.action === 'drain' && isWorkerOnlyEmailRequired()) {
      return sendJson(res, 403, {
        error: 'Browser email drain is disabled (Email V3). Workers process sends in the background.',
        code: 'BROWSER_DRAIN_DISABLED',
      })
    }

    const metaStore = await readStore({
      only: ['users', 'organizations', 'organizationMemberships', 'marketingCampaigns'],
    })
    const user = metaStore.users.find((u) => u.id === sessionUser.id) || sessionUser
    const org = user.organizationId ? getOrganization(metaStore, user.organizationId) : null
    const orgCanSend = isResendConfigured() && org && userCanSendOnOrgDomain(user, org).canSend
    const gmail = getUserCrmGmail(user)

    if (!orgCanSend && !gmail) {
      return sendJson(res, 400, {
        error:
          'Connect your work Gmail in the Workspace section (Work email or Team → CRM email for admins) to send from CRM.',
        needsOrgEmailSetup: true,
        needsGmailConnect: !gmail,
      })
    }

    if (body.action === 'queue') {
      if (!leadIds.length) {
        return sendJson(res, 400, { error: 'leadIds array is required' })
      }
      if (leadIds.length > MAX_BULK) {
        return sendJson(res, 400, { error: `Maximum ${MAX_BULK} leads per batch` })
      }
      try {
        const result = await queuePipelineBulkCampaign(user, metaStore, body)
        if (result.firstError && !result.sent && result.failed > 0) {
          return sendJson(res, 400, {
            error: result.firstError,
            ...result,
          })
        }
        return sendJson(res, 200, {
          ...result,
          sendStatus: result.sendStatus || 'queued',
        })
      } catch (err) {
        return sendJson(res, 400, { error: err.message || 'Queue failed' })
      }
    }

    const campaignId = String(body.campaignId || '').trim()
    if (!campaignId) {
      return sendJson(res, 400, { error: 'campaignId is required' })
    }
    const campaign = findPipelineBulkCampaign(metaStore, user, campaignId)
    if (!campaign) {
      return sendJson(res, 404, { error: 'Campaign not found' })
    }
    try {
      const burst = await drainPipelineBulkCampaign(user, campaignId, {
        limit: body.limit,
        maxMs: body.maxMs,
      })
      return sendJson(res, 200, burst)
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Send burst failed' })
    }
  }

  if (isWorkerOnlyEmailRequired()) {
    return sendJson(res, 403, {
      error:
        'Synchronous bulk email is disabled (Email V3). Use action: "queue" — workers send in the background.',
      code: 'SYNC_BULK_EMAIL_DISABLED',
    })
  }

  const subject = String(body.subject || '').trim()
  const emailBody = String(body.body || '').trim()
  const useAiPerLead = Boolean(body.useAiPerLead)
  const aiGenerated = Boolean(body.aiGenerated)
  const cc = parseEmailList(body.cc)
  const existingCampaignId = String(body.campaignId || '').trim() || null
  const finalize = Boolean(body.finalize)
  const enrollmentOffset = Math.max(0, Math.floor(Number(body.enrollmentOffset) || 0))

  if (!leadIds.length) {
    return sendJson(res, 400, { error: 'leadIds array is required' })
  }
  if (leadIds.length > MAX_BULK) {
    return sendJson(res, 400, { error: `Maximum ${MAX_BULK} leads per batch` })
  }
  if (useAiPerLead && leadIds.length > BULK_EMAIL_AI_MAX_PER_REQUEST) {
    return sendJson(res, 400, {
      error: `AI personalization sends up to ${BULK_EMAIL_AI_MAX_PER_REQUEST} leads per request. Larger sends are split automatically.`,
    })
  }

  const options = buildCrmDraftOptions(sessionUser, body)
  const agendaError = requireAgenda(options)
  if (useAiPerLead && agendaError) {
    return sendJson(res, 400, { error: agendaError })
  }
  if (!useAiPerLead && (!subject || !emailBody)) {
    return sendJson(res, 400, { error: 'Subject line and message body are required' })
  }
  if (!useAiPerLead && subject.length > 200) {
    return sendJson(res, 400, { error: 'Subject line is too long (max 200 characters)' })
  }

  const metaStore = await readStore({
    only: ['users', 'organizations', 'organizationMemberships'],
  })
  const user = metaStore.users.find((u) => u.id === sessionUser.id) || sessionUser
  const { pipelineStore } = await loadPipelineStoreForLeadIds(user, leadIds)
  const storeBefore = { ...metaStore, savedLeads: pipelineStore.savedLeads }
  const org = user.organizationId ? getOrganization(storeBefore, user.organizationId) : null
  const orgCanSend = isResendConfigured() && org && userCanSendOnOrgDomain(user, org).canSend
  const gmail = getUserCrmGmail(user)

  if (!orgCanSend && !gmail) {
    return sendJson(res, 400, {
      error: 'Connect your work Gmail in the Workspace section (Work email or Team → CRM email for admins) to send from CRM.',
      needsOrgEmailSetup: true,
      needsGmailConnect: !gmail,
    })
  }

  const scope = marketingScopeKey(user)
  const validRows = []
  const results = []
  let skippedCount = 0

  for (const leadId of leadIds) {
    const entry = findPipelineEntry(storeBefore, user, leadId)
    if (!entry) {
      skippedCount += 1
      results.push({ leadId, ok: false, error: 'Not in pipeline' })
      continue
    }
    const lead = entry.lead || entry
    if (!leadHasSendableEmail(lead)) {
      skippedCount += 1
      results.push({ leadId, ok: false, error: 'No sendable email on lead' })
      continue
    }
    validRows.push({ leadId, entry, lead })
  }

  let campaign = null
  const enrollmentByLeadId = new Map()

  if (validRows.length) {
    if (existingCampaignId) {
      campaign = findPipelineBulkCampaign(storeBefore, user, existingCampaignId)
      if (!campaign) {
        return sendJson(res, 400, { error: 'Campaign not found for this bulk send' })
      }
    } else {
      campaign = await createPipelineBulkCampaign(storeBefore, user, {
        subject: subject || 'Pipeline email',
        body: emailBody || '',
      })
    }

    let pendingRows = existingCampaignId
      ? await filterRowsPendingSend(campaign.id, validRows)
      : validRows

    if (!pendingRows.length) {
      const emptyPayload = {
        sentCount: 0,
        failedCount: 0,
        skippedCount,
        campaignId: campaign.id,
        results,
      }
      return sendJson(res, 200, emptyPayload)
    }

    const enrollments = pendingRows.map(({ leadId, lead }, index) => {
      const enrollment = buildPipelineBulkEnrollment({
        scope,
        campaignId: campaign.id,
        leadId,
        email: lead.email,
        index: enrollmentOffset + index,
      })
      enrollmentByLeadId.set(leadId, enrollment)
      return enrollment
    })

    if (enrollments.length) {
      if (existingCampaignId) {
        await appendPipelineBulkEnrollments(campaign.id, enrollments)
      } else {
        await seedPipelineBulkEnrollments(campaign.id, enrollments)
      }
    }

    const concurrency = bulkSendConcurrency({ useAiPerLead })
    const sendResults = await mapWithConcurrency(pendingRows, concurrency, ({ leadId, lead }) =>
      processLeadSend({
        leadId,
        lead,
        subject,
        emailBody,
        useAiPerLead,
        options,
        campaign,
        enrollmentByLeadId,
        storeBefore,
        user,
        cc,
        aiGenerated,
      })
    )

    const crmPatches = []
    let sentCount = 0
    let failedCount = 0

    for (const row of sendResults) {
      results.push(row)
      if (row.ok) {
        sentCount += 1
        if (row.crmPatch) crmPatches.push(row.crmPatch)
      } else {
        failedCount += 1
      }
    }

    if (crmPatches.length) {
      await patchPipelineEntriesCrmBatch(user, crmPatches, {
        mirrorToSavedLeads: false,
        refreshIndex: finalize,
      })
    }

    if (campaign) {
      await bumpPipelineBulkCampaignStats(
        storeBefore,
        user,
        campaign.id,
        {
          enrolled: pendingRows.length,
          sent: sentCount,
          failed: failedCount,
        },
        { finalize }
      )
    }

    const payload = {
      sentCount,
      failedCount,
      skippedCount,
      campaignId: campaign?.id || null,
      results,
      patchedLeadIds: crmPatches.map((p) => p.leadId),
    }

    return sendJson(res, 200, payload)
  }

  return sendJson(res, 200, {
    sentCount: 0,
    failedCount: 0,
    skippedCount,
    campaignId: campaign?.id || null,
    results,
  })
}
