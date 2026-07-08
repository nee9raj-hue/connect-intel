/**
 * Provider plugin registry — Gmail, Resend, SES, SendGrid, Mailgun, Microsoft 365 (future).
 * The messaging engine resolves providers here; callers do not branch on provider names.
 */
import { resolveMarketingEmailProvider, sendMarketingEmailViaProvider } from '../emailProviders/index.js'

export const MESSAGING_CHANNELS = {
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
}

export const EMAIL_PROVIDERS = {
  GMAIL: 'gmail',
  RESEND: 'resend',
  SES: 'ses',
  SENDGRID: 'sendgrid',
  MAILGUN: 'mailgun',
  MICROSOFT365: 'microsoft365',
  AUTO: 'auto',
}

export function resolveMessagingProvider(user, org, options = {}) {
  return resolveMarketingEmailProvider(user, org, options)
}

export async function sendViaMessagingProvider(payload) {
  return sendMarketingEmailViaProvider(payload)
}
