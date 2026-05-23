import { requireUser } from '../auth.js'
import { createId, readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { appendActivity, normalizeExtendedCrm } from '../crmWorkflow.js'
import { mergeLeadForClient } from '../crm.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { getOrganization, listPipelineEntries } from '../organizations.js'
import { getUserCrmGmail, sendCrmEmailFromUserMailbox } from '../crmUserGmail.js'
import { sendCrmEmailViaOrgResend, userCanSendOnOrgDomain } from '../orgEmailDomain.js'
import { isResendConfigured } from '../email.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const { leadId, subject, body, aiGenerated = false } = getBody(req)

  if (!leadId || !subject?.trim() || !body?.trim()) {
    return sendJson(res, 400, { error: 'leadId, subject, and body are required' })
  }

  const storeBefore = await readStore()
  const user = storeBefore.users.find((u) => u.id === sessionUser.id) || sessionUser
  const entryBefore = findPipelineEntry(storeBefore, user, leadId)
  if (!entryBefore) {
    return sendJson(res, 404, { error: 'Lead not in pipeline' })
  }

  const lead = entryBefore.lead || entryBefore
  const org = user.organizationId ? getOrganization(storeBefore, user.organizationId) : null

  let sendResult = { sent: false }

  const gmail = getUserCrmGmail(user)
  if (gmail) {
    sendResult = await sendCrmEmailFromUserMailbox({
      user,
      lead,
      subject: subject.trim(),
      body: body.trim(),
    })
  }

  if (!sendResult.sent && isResendConfigured() && org) {
    const orgCheck = userCanSendOnOrgDomain(user, org)
    if (orgCheck.canSend) {
      sendResult = await sendCrmEmailViaOrgResend({ user, lead, subject, body, org })
    }
  }

  if (!sendResult.sent) {
    const orgDomain = org?.emailDomain?.name
    return sendJson(res, 400, {
      error:
        sendResult.error ||
        'Connect your work Gmail (Pipeline → lead → Email, or Team → CRM email), or ask admin to verify optional DNS sending.',
      needsOrgEmailSetup: Boolean(orgDomain && !userCanSendOnOrgDomain(user, org).canSend),
      needsGmailConnect: !gmail,
      orgDomain: orgDomain || null,
    })
  }

  const sentAt = new Date().toISOString()

  const store = await updateStore((draft) => {
    const entry = findPipelineEntry(draft, user, leadId)
    if (!entry) return draft

    let crm = normalizeExtendedCrm(entry.crm)
    crm.emails = [
      {
        id: createId('email'),
        sentAt,
        subject: subject.trim(),
        bodyPreview: body.trim().slice(0, 240),
        aiGenerated: Boolean(aiGenerated),
        fromMailbox: sendResult.mailbox || user.email,
        gmailMessageId: sendResult.id || null,
        provider: sendResult.provider || 'email',
      },
      ...crm.emails,
    ].slice(0, 50)
    crm.lastEmailSentAt = sentAt
    crm.lastCommunicationAt = sentAt
    crm.lastCommunicationType = 'email'
    crm.lastCommunicationSummary = subject.trim()
    if (crm.status === 'new') crm.status = 'contacted'
    crm = appendActivity(crm, {
      type: 'email',
      summary: `Email sent: ${subject.trim()}`,
      userId: user.id,
      userName: user.name,
      meta: { aiGenerated: Boolean(aiGenerated), from: sendResult.mailbox, provider: sendResult.provider },
    })
    entry.crm = crm
    return draft
  })

  const entry = findPipelineEntry(store, user, leadId)
  if (!entry) {
    return sendJson(res, 404, { error: 'Lead not in pipeline' })
  }

  return sendJson(res, 200, {
    lead: mergeLeadForClient(entry),
    leads: listPipelineEntries(store, user),
    sentAt,
    emailSent: true,
    from: sendResult.from,
    mailbox: sendResult.mailbox,
    provider: sendResult.provider,
  })
}
