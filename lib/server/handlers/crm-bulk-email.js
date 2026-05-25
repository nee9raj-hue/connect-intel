import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { generateAiEmail } from '../crm.js'
import { buildCrmDraftOptions, requireAgenda } from '../crmEmailPrompt.js'
import { normalizeExtendedCrm } from '../crmWorkflow.js'
import { recordOutboundEmail } from '../crmEmailThread.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { getOrganization, listPipelineEntries } from '../organizations.js'
import { getUserCrmGmail, sendCrmEmailFromUserMailbox } from '../crmUserGmail.js'
import { sendCrmEmailViaOrgResend, userCanSendOnOrgDomain } from '../orgEmailDomain.js'
import { isResendConfigured } from '../email.js'
import { parseEmailList } from '../emailList.js'

const MAX_BULK = 50

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

  const options = buildCrmDraftOptions(sessionUser, body)
  const agendaError = requireAgenda(options)
  if (useAiPerLead && agendaError) {
    return sendJson(res, 400, { error: agendaError })
  }
  if (!useAiPerLead && (!subject || !emailBody)) {
    return sendJson(res, 400, { error: 'subject and body are required (or enable AI per lead with agenda)' })
  }

  const storeBefore = await readStore()
  const user = storeBefore.users.find((u) => u.id === sessionUser.id) || sessionUser
  const org = user.organizationId ? getOrganization(storeBefore, user.organizationId) : null
  const orgCanSend = isResendConfigured() && org && userCanSendOnOrgDomain(user, org).canSend
  const gmail = getUserCrmGmail(user)

  if (!orgCanSend && !gmail) {
    return sendJson(res, 400, {
      error: 'Connect work Gmail under Team → CRM email to send from CRM.',
      needsOrgEmailSetup: true,
      needsGmailConnect: !gmail,
    })
  }

  const results = []
  let sentCount = 0
  let failedCount = 0
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

    let subj = subject
    let bodyText = emailBody

    if (useAiPerLead) {
      try {
        const draft = await generateAiEmail(lead, options)
        subj = draft.subject || subj
        bodyText = draft.body || bodyText
      } catch (e) {
        failedCount += 1
        results.push({ leadId, ok: false, error: e.message })
        continue
      }
    }

    if (!subj?.trim() || !bodyText?.trim()) {
      failedCount += 1
      results.push({ leadId, ok: false, error: 'Empty subject or body' })
      continue
    }

    let sendResult = { sent: false }
    if (gmail) {
      sendResult = await sendCrmEmailFromUserMailbox({
        user,
        lead,
        subject: subj,
        body: bodyText,
        cc,
      })
    }
    if (!sendResult.sent && orgCanSend) {
      sendResult = await sendCrmEmailViaOrgResend({
        user,
        lead,
        subject: subj,
        body: bodyText,
        org,
        cc,
      })
    }

    if (!sendResult.sent) {
      failedCount += 1
      results.push({ leadId, ok: false, error: sendResult.error || 'Send failed' })
      continue
    }

    const sentAt = new Date().toISOString()
    await updateStore((draft) => {
      const e = findPipelineEntry(draft, user, leadId)
      if (!e) return draft
      e.crm = recordOutboundEmail(
        e.crm,
        {
          subject: subj.trim(),
          body: bodyText.trim(),
          sentAt,
          cc: cc.length ? cc : undefined,
          aiGenerated: useAiPerLead || aiGenerated,
          fromMailbox: sendResult.mailbox || user.email,
          toEmail: lead.email,
          gmailMessageId: sendResult.id || null,
          provider: sendResult.provider || 'bulk',
        },
        { userId: user.id, userName: user.name }
      )
      return draft
    })

    sentCount += 1
    results.push({ leadId, ok: true, subject: subj })
  }

  const store = await readStore()
  return sendJson(res, 200, {
    sentCount,
    failedCount,
    skippedCount,
    results,
    leads: listPipelineEntries(store, user, { light: true }),
  })
}
