import { requireUser } from '../auth.js'
import { createId, readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { appendActivity, normalizeExtendedCrm } from '../crmWorkflow.js'
import { mergeLeadForClient } from '../crm.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { listPipelineEntries } from '../organizations.js'
import { getUserCrmGmail, sendCrmEmailFromUserMailbox } from '../crmUserGmail.js'

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
  const gmail = getUserCrmGmail(user)
  if (!gmail) {
    return sendJson(res, 400, {
      error: 'Connect your work Gmail before sending (Email tab → Connect Gmail).',
      needsGmailConnect: true,
    })
  }

  const sendResult = await sendCrmEmailFromUserMailbox({
    user,
    lead,
    subject: subject.trim(),
    body: body.trim(),
  })

  if (!sendResult.sent) {
    return sendJson(res, 400, {
      error: sendResult.error || 'Could not send email via Gmail',
      needsGmailConnect: Boolean(sendResult.needsGmailConnect),
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
        fromMailbox: sendResult.mailbox || gmail.email,
        gmailMessageId: sendResult.id || null,
        provider: 'crm_gmail',
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
      meta: { aiGenerated: Boolean(aiGenerated), from: sendResult.mailbox },
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
    gmailSent: true,
    from: sendResult.from,
    mailbox: sendResult.mailbox,
  })
}
