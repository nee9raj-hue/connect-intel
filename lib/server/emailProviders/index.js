import { isResendConfigured } from '../email.js'
import { getUserCrmGmail, sendCrmEmailFromUserMailbox } from '../crmUserGmail.js'
import { sendCrmEmailViaOrgResend, userCanSendOnOrgDomain } from '../orgEmailDomain.js'
import { sendViaSes } from './ses.js'
import { sendViaSendGrid } from './sendgrid.js'

export const EMAIL_PROVIDERS = ['auto', 'resend', 'gmail', 'ses', 'sendgrid']

export function resolveMarketingEmailProvider(user, org, campaign) {
  const orgProvider = org?.marketingSettings?.emailProvider || org?.emailProvider
  const campaignProvider = campaign?.emailProvider
  const pick = campaignProvider || orgProvider || 'auto'

  if (pick === 'ses' && process.env.AWS_SES_REGION) return 'ses'
  if (pick === 'sendgrid' && process.env.SENDGRID_API_KEY) return 'sendgrid'
  if (pick === 'gmail') return 'gmail'
  if (pick === 'resend') return 'resend'

  const gmail = getUserCrmGmail(user)
  const orgCanSend = isResendConfigured() && org && userCanSendOnOrgDomain(user, org).canSend
  if (orgCanSend) return 'resend'
  if (gmail) return 'gmail'
  if (process.env.SENDGRID_API_KEY) return 'sendgrid'
  if (process.env.AWS_SES_REGION) return 'ses'
  return 'resend'
}

export async function sendMarketingEmailViaProvider({
  provider,
  user,
  org,
  lead,
  subject,
  body,
  html,
  htmlAppend,
}) {
  if (provider === 'ses') {
    return sendViaSes({ user, org, lead, subject, body, html, htmlAppend })
  }
  if (provider === 'sendgrid') {
    return sendViaSendGrid({ user, org, lead, subject, body, html, htmlAppend })
  }
  if (provider === 'gmail') {
    return sendCrmEmailFromUserMailbox({ user, lead, subject, body, html, htmlAppend })
  }
  if (provider === 'resend' && org && userCanSendOnOrgDomain(user, org).canSend) {
    return sendCrmEmailViaOrgResend({ user, lead, subject, body, html, org, htmlAppend })
  }
  const gmail = getUserCrmGmail(user)
  if (gmail) {
    return sendCrmEmailFromUserMailbox({ user, lead, subject, body, html, htmlAppend })
  }
  if (org && userCanSendOnOrgDomain(user, org).canSend) {
    return sendCrmEmailViaOrgResend({ user, lead, subject, body, html, org, htmlAppend })
  }
  return { sent: false, error: 'No email provider configured' }
}
