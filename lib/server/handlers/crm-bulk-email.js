import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import {
  loadPipelineStoreForLeadIds,
  loadPipelineStoreContext,
  patchPipelineEntriesCrm,
} from '../pipelineShard.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { generateAiEmail } from '../crm.js'
import { buildCrmDraftOptions, requireAgenda } from '../crmEmailPrompt.js'
import { recordOutboundEmail } from '../crmEmailThread.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { getOrganization, listPipelineEntries } from '../organizations.js'
import { getUserCrmGmail } from '../crmUserGmail.js'
import { userCanSendOnOrgDomain } from '../orgEmailDomain.js'
import { isResendConfigured } from '../email.js'
import { parseEmailList } from '../emailList.js'
import { mergeTemplateFields } from '../marketingTemplates.js'
import { marketingScopeKey } from '../marketingAccess.js'
import { sendMarketingMessage } from '../marketingSend.js'
import {
  buildPipelineBulkEnrollment,
  completePipelineBulkCampaign,
  createPipelineBulkCampaign,
  markPipelineBulkEnrollmentSent,
  seedPipelineBulkEnrollments,
} from '../pipelineBulkCampaign.js'
import { BULK_EMAIL_MAX, BULK_EMAIL_AI_MAX_PER_REQUEST } from '../../bulkEmailLimits.js'

const MAX_BULK = BULK_EMAIL_MAX

function fallbackSubject(lead, baseSubject) {
  const trimmed = String(baseSubject || '').trim()
  if (trimmed) return trimmed
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || lead.company
  return name ? `Message for ${name}` : 'Message from your contact'
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const body = getBody(req)
  const leadIds = Array.isArray(body.leadIds) ? [...new Set(body.leadIds)] : []
  const subject = String(body.subject || '').trim()
  const emailBody = String(body.body || '').trim()
  const useAiPerLead = Boolean(body.useAiPerLead)
  const aiGenerated = Boolean(body.aiGenerated)
  const cc = parseEmailList(body.cc)

  if (!leadIds.length) {
    return sendJson(res, 400, { error: 'leadIds array is required' })
  }
  if (leadIds.length > MAX_BULK) {
    return sendJson(res, 400, { error: `Maximum ${MAX_BULK} leads per batch` })
  }
  if (useAiPerLead && leadIds.length > BULK_EMAIL_AI_MAX_PER_REQUEST) {
    return sendJson(res, 400, {
      error: `AI personalization sends up to ${BULK_EMAIL_AI_MAX_PER_REQUEST} leads per request. The app sends larger selections in smaller batches automatically.`,
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
    if (!String(lead.email || '').includes('@')) {
      skippedCount += 1
      results.push({ leadId, ok: false, error: 'No email on lead' })
      continue
    }
    validRows.push({ leadId, entry, lead })
  }

  let campaign = null
  const enrollmentByLeadId = new Map()

  if (validRows.length) {
    campaign = await createPipelineBulkCampaign(storeBefore, user, {
      subject: subject || 'Pipeline email',
      body: emailBody || '',
    })
    const enrollments = validRows.map(({ leadId, lead }, index) => {
      const enrollment = buildPipelineBulkEnrollment({
        scope,
        campaignId: campaign.id,
        leadId,
        email: lead.email,
        index,
      })
      enrollmentByLeadId.set(leadId, enrollment)
      return enrollment
    })
    await seedPipelineBulkEnrollments(campaign.id, enrollments)
  }

  const crmPatches = []
  let sentCount = 0
  let failedCount = 0

  for (const { leadId, lead } of validRows) {
    let subj = subject
    let bodyText = emailBody

    if (useAiPerLead) {
      try {
        const draft = await generateAiEmail(lead, options)
        subj = draft.subject || subj
        bodyText = draft.body || bodyText
      } catch (e) {
        failedCount += 1
        const enrollment = enrollmentByLeadId.get(leadId)
        if (campaign && enrollment) {
          await markPipelineBulkEnrollmentSent(campaign.id, enrollment, { error: e.message })
        }
        results.push({ leadId, ok: false, error: e.message })
        continue
      }
    }

    subj = fallbackSubject(lead, subj)
    if (!bodyText?.trim()) {
      failedCount += 1
      const enrollment = enrollmentByLeadId.get(leadId)
      if (campaign && enrollment) {
        await markPipelineBulkEnrollmentSent(campaign.id, enrollment, { error: 'Empty body' })
      }
      results.push({ leadId, ok: false, error: 'Empty subject or body' })
      continue
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
      failedCount += 1
      if (campaign && enrollment) {
        await markPipelineBulkEnrollmentSent(campaign.id, enrollment, { error: sendResult.error })
      }
      results.push({ leadId, ok: false, error: sendResult.error || 'Send failed' })
      continue
    }

    if (campaign && enrollment) {
      await markPipelineBulkEnrollmentSent(campaign.id, enrollment, { sendResult })
    }

    const sentAt = sendResult.sentAt || new Date().toISOString()
    crmPatches.push({
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
    })

    sentCount += 1
    results.push({ leadId, ok: true, subject: subj })
  }

  if (crmPatches.length) {
    await patchPipelineEntriesCrm(user, crmPatches)
  }

  if (campaign) {
    await completePipelineBulkCampaign(campaign.id, {
      enrolled: validRows.length,
      sent: sentCount,
      failed: failedCount,
    })
  }

  const reload = await loadPipelineStoreContext(user)
  const store = {
    ...metaStore,
    savedLeads: reload.visible.length ? reload.pipelineStore.savedLeads : storeBefore.savedLeads,
  }
  return sendJson(res, 200, {
    sentCount,
    failedCount,
    skippedCount,
    campaignId: campaign?.id || null,
    results,
    leads: listPipelineEntries(store, user, { light: true }),
  })
}
