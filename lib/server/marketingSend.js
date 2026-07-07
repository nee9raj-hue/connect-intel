import { isResendConfigured } from './email.js'
import { resolveMarketingEmailProvider, sendMarketingEmailViaProvider } from './emailProviders/index.js'
import { recordOutboundEmail } from './crmEmailThread.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { getUserCrmGmail, sendCrmEmailFromUserMailbox } from './crmUserGmail.js'
import {
  sendCrmEmailViaOrgResend,
  userCanSendOnOrgDomain,
} from './orgEmailDomain.js'
import { checkCommercialEmailAllowed } from './emailConsentEnforce.js'
import { isEmailSuppressed, unsubscribeUrl } from './marketingUnsubscribe.js'
import { filterMarketingRows, getUserOrg } from './marketingAccess.js'
import {
  marketingFooterHtml,
  resolveMessageContent,
} from './marketingEmailDesign.js'
import {
  appendHtmlTrackingPixel,
  createTrackingToken,
  trackingPixelHtml,
  wrapLinksForTracking,
  wrapLinksInHtml,
} from './marketingTracking.js'
import { recordEmailSend } from './emailSends.js'
import { recordMarketingEvent } from './marketingEvents.js'

export function appendMarketingFooter(body, { scope, toEmail, orgName }) {
  const unsub = unsubscribeUrl(scope, toEmail)
  const footer = [
    '',
    '---',
    orgName ? `${orgName}` : 'Connect Intel',
    `Unsubscribe: ${unsub}`,
  ].join('\n')
  const main = String(body || '').trimEnd()
  if (main.includes(unsub)) return main
  return `${main}${footer}`
}

function injectHtmlMarketingFooter(html, { scope, toEmail, orgName }) {
  const unsub = unsubscribeUrl(scope, toEmail)
  if (String(html).includes(unsub)) return html
  const footerRow = marketingFooterHtml({ orgName, unsubscribeUrl: unsub })
  const marker = '</table>\n</td></tr>\n</table>'
  if (html.includes(marker)) {
    return html.replace(marker, `${footerRow}\n</table>\n</td></tr>\n</table>`)
  }
  return `${html}${footerRow}`
}

export async function sendMarketingMessage({
  store,
  user,
  lead,
  leadId,
  subject,
  body,
  blocks,
  design,
  htmlBody,
  previewText,
  template,
  campaignId,
  stepIndex,
  enrollmentId,
  emailProvider,
  auditSource = 'marketing_campaign',
}) {
  const toEmail = String(lead.email || '').trim().toLowerCase()
  if (!toEmail.includes('@')) {
    return { sent: false, error: 'No email on lead', skipped: true }
  }

  const scope = user.organizationId
    ? { organizationId: user.organizationId, createdByUserId: null }
    : { organizationId: null, createdByUserId: user.id }

  if (isEmailSuppressed(store, { ...scope, email: toEmail })) {
    return { sent: false, error: 'Unsubscribed', suppressed: true }
  }

  const consentCheck = checkCommercialEmailAllowed(lead, store, scope)
  if (!consentCheck.ok) {
    return {
      sent: false,
      error: consentCheck.error,
      skipped: true,
      code: consentCheck.code,
    }
  }

  const marketingForms = filterMarketingRows(store.marketingForms || [], user)
  const resolved = resolveMessageContent(
    { subject, body, blocks, design, htmlBody, previewText },
    template,
    lead,
    { marketingForms }
  )
  const org = getUserOrg(store, user)
  const orgName = org?.name || user.organizationName || user.company || 'Connect Intel'

  const trackingToken =
    campaignId && enrollmentId
      ? createTrackingToken({
          campaignId,
          enrollmentId,
          leadId,
          organizationId: scope.organizationId,
          createdByUserId: scope.createdByUserId,
        })
      : null

  const bodyWithLinks = trackingToken
    ? wrapLinksForTracking(resolved.body, trackingToken)
    : resolved.body

  const fullBody = appendMarketingFooter(bodyWithLinks, {
    scope,
    toEmail,
    orgName,
  })

  let html = resolved.htmlBody
  if (html) {
    if (trackingToken) {
      html = wrapLinksInHtml(html, trackingToken)
    }
    html = injectHtmlMarketingFooter(html, { scope, toEmail, orgName })
    if (trackingToken) {
      html = appendHtmlTrackingPixel(html, trackingToken)
    }
  }

  const htmlAppend = !html && trackingToken ? trackingPixelHtml(trackingToken) : undefined

  const gmail = getUserCrmGmail(user)
  const orgCanSend = isResendConfigured() && org && userCanSendOnOrgDomain(user, org).canSend

  if (!gmail && !orgCanSend) {
    const orgCheck = org ? userCanSendOnOrgDomain(user, org) : null
    let error =
      'Connect your work Gmail first — open Work email in the sidebar (Workspace), then retry.'
    if (org?.emailDomain?.name && orgCheck?.reason === 'email_domain_mismatch') {
      error = orgCheck.hint || error
    } else if (org?.emailDomain?.name && org?.emailDomain?.status !== 'verified') {
      error = 'Your company email domain is not verified yet — ask your organization admin to finish DNS setup.'
    }
    return {
      sent: false,
      error,
      needsSetup: true,
      needsGmailConnect: !gmail,
    }
  }

  const provider = resolveMarketingEmailProvider(user, org, { emailProvider })
  const sendResult = await sendMarketingEmailViaProvider({
    provider,
    user,
    org,
    lead,
    subject: resolved.subject,
    body: fullBody,
    html,
    htmlAppend: html ? undefined : htmlAppend,
  })

  if (!sendResult.sent) {
    void recordEmailSend({
      organizationId: user.organizationId,
      actorUserId: user.id,
      source: auditSource,
      channel: 'email',
      provider: sendResult.provider,
      toEmail,
      leadId,
      campaignId,
      enrollmentId,
      subject: resolved.subject,
      status: 'failed',
      errorMessage: sendResult.error || 'Send failed',
      metadata: { stepIndex: stepIndex ?? null },
    }).catch(() => {})
    return { sent: false, error: sendResult.error || 'Send failed' }
  }

  const sentAt = new Date().toISOString()
  void recordEmailSend({
    organizationId: user.organizationId,
    actorUserId: user.id,
    source: auditSource,
    channel: 'email',
    provider: sendResult.provider,
    providerMessageId: sendResult.id || null,
    toEmail,
    leadId,
    campaignId,
    enrollmentId,
    subject: resolved.subject,
    status: 'sent',
    metadata: { stepIndex: stepIndex ?? null },
  }).catch(() => {})
  const result = {
    sent: true,
    sentAt,
    subject: resolved.subject,
    body: fullBody,
    provider: sendResult.provider || 'marketing',
    mailbox: sendResult.mailbox,
    trackingToken,
    logPayload: {
      subject: resolved.subject.trim(),
      body: fullBody.trim(),
      sentAt,
      fromMailbox: sendResult.mailbox || user.email,
      toEmail,
      gmailMessageId: sendResult.id || null,
      resendId: sendResult.provider === 'resend' ? sendResult.id || null : null,
      provider: sendResult.provider || 'marketing',
      campaignId: campaignId || null,
      campaignStep: stepIndex ?? null,
    },
    leadId,
  }
  void logMarketingSend(user, result).catch(() => {})
  if (auditSource === 'marketing_campaign' && campaignId && leadId) {
    void recordMarketingEvent({
      organizationId: user.organizationId,
      createdByUserId: user.id,
      campaignId,
      enrollmentId,
      leadId,
      type: 'send',
      actorUser: user,
    }).catch(() => {})
  }
  return result
}

export async function logMarketingSend(user, sendResult) {
  if (!sendResult.sent || !sendResult.leadId || !sendResult.logPayload) return
  const { updateStore } = await import('./store.js')
  await updateStore((draft) => {
    const entry = findPipelineEntry(draft, user, sendResult.leadId)
    if (!entry) return draft
    entry.crm = recordOutboundEmail(entry.crm, sendResult.logPayload, {
      userId: user.id,
      userName: user.name,
    })
    return draft
  })
}
