import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { recordOutboundEmail } from '../crmEmailThread.js'
import { mergeLeadForTenant } from '../tenantIsolation.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { getOrganization, listPipelineEntries } from '../organizations.js'
import { getUserCrmGmail, sendCrmEmailFromUserMailbox } from '../crmUserGmail.js'
import { sendCrmEmailViaOrgResend, userCanSendOnOrgDomain } from '../orgEmailDomain.js'
import { isResendConfigured } from '../email.js'
import { parseEmailList } from '../emailList.js'
import {
  appendEmailSignature,
  attachmentMetadataForRecord,
  validateEmailAttachments,
} from '../crmEmailCompose.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const {
    leadId,
    subject,
    body,
    aiGenerated = false,
    cc: ccRaw,
    attachments: attachmentsRaw,
    includeSignature,
  } = getBody(req)
  const cc = parseEmailList(ccRaw)

  if (!leadId || !subject?.trim() || !body?.trim()) {
    return sendJson(res, 400, { error: 'leadId, subject, and body are required' })
  }

  let attachments = []
  try {
    attachments = validateEmailAttachments(attachmentsRaw)
  } catch (e) {
    return sendJson(res, 400, { error: e.message })
  }

  const storeBefore = await readStore()
  const user = storeBefore.users.find((u) => u.id === sessionUser.id) || sessionUser
  const entryBefore = findPipelineEntry(storeBefore, user, leadId)
  if (!entryBefore) {
    return sendJson(res, 404, { error: 'Lead not in pipeline' })
  }

  const lead = entryBefore.lead || entryBefore
  const org = user.organizationId ? getOrganization(storeBefore, user.organizationId) : null

  const shouldIncludeSignature =
    includeSignature !== false && user.includeEmailSignature !== false
  const messageBody = appendEmailSignature(
    body.trim(),
    shouldIncludeSignature ? user.emailSignature : ''
  )

  let sendResult = { sent: false }

  const gmail = getUserCrmGmail(user)
  if (gmail) {
    sendResult = await sendCrmEmailFromUserMailbox({
      user,
      lead,
      subject: subject.trim(),
      body: messageBody,
      cc,
      attachments,
    })
  }

  if (!sendResult.sent && isResendConfigured() && org) {
    if (attachments.length > 0 && !gmail) {
      return sendJson(res, 400, {
        error: 'File attachments require a connected work Gmail account.',
        needsGmailConnect: true,
      })
    }
    const orgCheck = userCanSendOnOrgDomain(user, org)
    if (orgCheck.canSend) {
      sendResult = await sendCrmEmailViaOrgResend({
        user,
        lead,
        subject,
        body: messageBody,
        org,
        cc,
        attachments,
      })
    }
  }

  if (!sendResult.sent) {
    const orgDomain = org?.emailDomain?.name
    return sendJson(res, 400, {
      error:
        sendResult.error ||
        'Connect your work Gmail under Team → CRM email (or Pipeline → Email tab) to send from CRM.',
      needsOrgEmailSetup: Boolean(orgDomain && !userCanSendOnOrgDomain(user, org).canSend),
      needsGmailConnect: !gmail,
      orgDomain: orgDomain || null,
    })
  }

  const sentAt = new Date().toISOString()
  const attachmentMeta = attachmentMetadataForRecord(attachments)

  const store = await updateStore((draft) => {
    const entry = findPipelineEntry(draft, user, leadId)
    if (!entry) return draft

    entry.crm = recordOutboundEmail(
      entry.crm,
      {
        subject: subject.trim(),
        body: messageBody,
        sentAt,
        cc: cc.length ? cc : undefined,
        attachments: attachmentMeta.length ? attachmentMeta : undefined,
        aiGenerated: Boolean(aiGenerated),
        fromMailbox: sendResult.mailbox || user.email,
        toEmail: lead.email,
        gmailMessageId: sendResult.id || null,
        threadId: sendResult.threadId || null,
        provider: sendResult.provider || 'email',
      },
      { userId: user.id, userName: user.name }
    )
    return draft
  })

  const entry = findPipelineEntry(store, user, leadId)
  if (!entry) {
    return sendJson(res, 404, { error: 'Lead not in pipeline' })
  }

  return sendJson(res, 200, {
    lead: mergeLeadForTenant(store, user, entry),
    leads: listPipelineEntries(store, user, { light: true }),
    sentAt,
    emailSent: true,
    from: sendResult.from,
    mailbox: sendResult.mailbox,
    provider: sendResult.provider,
    attachmentCount: attachmentMeta.length,
  })
}
