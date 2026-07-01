import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import {
  loadPipelineStoreForLeadIds,
  META_STORE_COLLECTIONS,
  patchPipelineEntryCrm,
} from '../pipelineShard.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { recordOutboundEmail } from '../crmEmailThread.js'
import { mergeLeadForTenant } from '../tenantIsolation.js'
import { findPipelineEntryAsync } from '../pipelineVisibility.js'
import { getOrganization, listPipelineEntries } from '../organizations.js'
import { getUserCrmGmail, sendCrmEmailFromUserMailbox } from '../crmUserGmail.js'
import { sendCrmEmailViaOrgResend, userCanSendOnOrgDomain } from '../orgEmailDomain.js'
import { isResendConfigured } from '../email.js'
import { parseEmailList } from '../emailList.js'
import { checkCommercialEmailAllowed } from '../emailConsentEnforce.js'
import {
  appendEmailSignature,
  attachmentMetadataForRecord,
  validateEmailAttachments,
} from '../crmEmailCompose.js'
import { assertOrgPermission, permissionDeniedResponse } from '../permissionEnforce.js'

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

  const metaStore = await readStore({
    only: META_STORE_COLLECTIONS,
  })
  const user = metaStore.users.find((u) => u.id === sessionUser.id) || sessionUser

  try {
    await assertOrgPermission(user, 'edit_leads', metaStore)
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  const { pipelineStore, visible } = await loadPipelineStoreForLeadIds(user, [leadId])
  const entryBefore = visible[0] || (await findPipelineEntryAsync(
    { ...metaStore, savedLeads: pipelineStore.savedLeads },
    user,
    leadId,
    metaStore
  ))
  if (!entryBefore) {
    return sendJson(res, 404, { error: 'Lead not in pipeline' })
  }

  const storeBefore = { ...metaStore, savedLeads: pipelineStore.savedLeads }

  const lead = entryBefore.lead || entryBefore
  const org = user.organizationId ? getOrganization(storeBefore, user.organizationId) : null

  const emailScope = user.organizationId
    ? { organizationId: user.organizationId, createdByUserId: null }
    : { organizationId: null, createdByUserId: user.id }
  const consentCheck = checkCommercialEmailAllowed(lead, storeBefore, emailScope)
  if (!consentCheck.ok) {
    return sendJson(res, 400, {
      error: consentCheck.error,
      code: consentCheck.code,
      needsEmailConsent: consentCheck.code === 'no_consent',
    })
  }

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
        'Connect your work Gmail in the Workspace section (Work email or Team → CRM email for admins) to send from CRM.',
      needsOrgEmailSetup: Boolean(orgDomain && !userCanSendOnOrgDomain(user, org).canSend),
      needsGmailConnect: !gmail,
      orgDomain: orgDomain || null,
    })
  }

  const sentAt = new Date().toISOString()
  const attachmentMeta = attachmentMetadataForRecord(attachments)

  const updatedEntry = await patchPipelineEntryCrm(
    user,
    leadId,
    (crm) =>
      recordOutboundEmail(
        crm,
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
          rfc822MessageId: sendResult.rfc822MessageId || null,
          provider: sendResult.provider || 'email',
        },
        { userId: user.id, userName: user.name }
      ),
    { preloadedEntry: entryBefore, metaStore }
  )
  if (!updatedEntry) {
    return sendJson(res, 404, { error: 'Lead not in pipeline' })
  }

  const savedLeads = pipelineStore.savedLeads.map((row) =>
    row?.lead?.id != null && String(row.lead.id) === String(leadId) ? updatedEntry : row
  )
  const responseStore = { ...metaStore, savedLeads }
  return sendJson(res, 200, {
    lead: mergeLeadForTenant(responseStore, user, updatedEntry),
    leads: listPipelineEntries(responseStore, user, { light: true }),
    sentAt,
    emailSent: true,
    from: sendResult.from,
    mailbox: sendResult.mailbox,
    provider: sendResult.provider,
    attachmentCount: attachmentMeta.length,
  })
}
