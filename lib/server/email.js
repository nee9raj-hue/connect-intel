import crypto from 'node:crypto'
import { getAppBaseUrl, getOAuthRedirectBaseUrl } from './appUrl.js'
import { getGmailOAuthRedirectUri } from './gmailOAuth.js'
import {
  COMPANY_MAILBOX,
  isGmailOAuthConfigured,
  resolveInviteGmailOAuthForOrg,
  sendViaGmailOAuth,
} from './gmailOAuth.js'
import { getGmailSetupHint, isGmailSmtpConfigured, sendViaGmailSmtp } from './gmailSmtp.js'
import { buildInviteEmailContent } from './inviteEmailContent.js'
import {
  getResendDomainDetails,
  getResendDomainSendStatus,
  getResendEmailStatus,
  mailboxDomain,
  triggerResendDomainVerify,
} from './resend.js'

export { getAppBaseUrl }

export function createInviteToken() {
  return crypto.randomBytes(24).toString('hex')
}

export function buildInviteUrl(token) {
  return `${getAppBaseUrl()}/?invite=${encodeURIComponent(token)}`
}

export function isResendConfigured() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim())
}

function parseConfiguredFrom() {
  const configured = String(process.env.EMAIL_FROM || process.env.RESEND_INVITE_FROM || '').trim()
  if (!configured) {
    return { name: 'Connect Intel', email: 'onboarding@resend.dev', isDefault: true }
  }

  const match = configured.match(/^(.+?)\s*<([^>]+)>$/s)
  if (match) {
    return {
      name: match[1].trim().replace(/^["']|["']$/g, ''),
      email: match[2].trim().toLowerCase(),
      isDefault: false,
    }
  }

  if (configured.includes('@')) {
    return { name: 'Connect Intel', email: configured.toLowerCase(), isDefault: false }
  }

  return { name: 'Connect Intel', email: 'onboarding@resend.dev', isDefault: true }
}

export function isResendTestSender(email) {
  const mailbox = String(email || '').toLowerCase()
  return mailbox === 'onboarding@resend.dev' || mailbox.endsWith('@resend.dev')
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
])

export function isPersonalEmailMailbox(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase()
  return domain ? PERSONAL_EMAIL_DOMAINS.has(domain) : false
}

export function formatEmailAddress(displayName, mailbox) {
  const safeName = String(displayName || 'Connect Intel')
    .replace(/"/g, "'")
    .replace(/[\r\n<>]/g, ' ')
    .trim()
    .slice(0, 100)
  const email = String(mailbox || '').trim().toLowerCase()
  return `"${safeName}" <${email}>`
}

export function buildInviteFromHeader({ inviterName, inviterEmail, organizationName }) {
  const base = parseConfiguredFrom()
  const inviterLabel = [inviterName, organizationName].filter(Boolean).join(' - ') || base.name
  const hint = getInviteEmailSetupHint({
    isTestSender: isResendTestSender(base.email),
    isDefaultFrom: base.isDefault,
    mailbox: base.email,
  })

  return {
    from: formatEmailAddress(inviterLabel, base.email),
    mailbox: base.email,
    isTestSender: isResendTestSender(base.email),
    isDefaultFrom: base.isDefault,
    isPersonalMailbox: isPersonalEmailMailbox(base.email),
    setupBlocked: Boolean(hint),
    hint,
  }
}

export function getInviteEmailSetupHint({ isTestSender, isDefaultFrom, mailbox } = {}) {
  if (isTestSender || isDefaultFrom) {
    return (
      'Resend test sender (onboarding@resend.dev) cannot email teammates. ' +
      'Use Gmail SMTP (recommended) or verify your domain in Resend.'
    )
  }
  if (mailbox && isPersonalEmailMailbox(mailbox)) {
    return (
      `EMAIL_FROM is ${mailbox}. For Resend, use a verified company domain. ` +
      'Or use Gmail SMTP with GMAIL_SMTP_APP_PASSWORD (no DNS changes).'
    )
  }
  return null
}

export { COMPANY_MAILBOX }
export const ROOT_SPF_RECORD = 'v=spf1 include:_spf.google.com include:amazonses.com ~all'

function getInviteEmailProviderMode() {
  const mode = String(process.env.INVITE_EMAIL_PROVIDER || 'resend').toLowerCase()
  if (['auto', 'gmail', 'resend'].includes(mode)) return mode
  return 'resend'
}

function useCompanyInviteMailbox(fromMeta) {
  const mailbox = String(fromMeta?.mailbox || '').toLowerCase()
  return mailbox.endsWith('@connectintel.net') || mailbox === COMPANY_MAILBOX
}

async function tryResendProvider(fromMeta) {
  if (!isResendConfigured() || fromMeta.setupBlocked) return 'none'
  const ds = await getResendDomainSendStatus(fromMeta.mailbox)
  return ds.canSend ? 'resend' : 'none'
}

async function resolveActiveProvider(fromMeta, orgOAuth) {
  const mode = getInviteEmailProviderMode()
  const companyOnly = useCompanyInviteMailbox(fromMeta)

  if (orgOAuth?.refreshToken) {
    return 'gmail_oauth'
  }

  if (companyOnly || mode === 'resend') {
    return tryResendProvider(fromMeta)
  }

  if (mode === 'gmail') {
    return isGmailSmtpConfigured() ? 'gmail' : 'none'
  }

  // auto (non-company mailbox only): optional gmail, then resend
  if (isGmailSmtpConfigured()) return 'gmail'
  return tryResendProvider(fromMeta)
}

async function sendViaResend({ fromMeta, content, inviterEmail }) {
  const domainStatus = await getResendDomainSendStatus(fromMeta.mailbox)
  if (!domainStatus.canSend) {
    return {
      sent: false,
      error: domainStatus.hint,
      hint: domainStatus.hint,
      provider: 'resend',
      resendDomainStatus: domainStatus.status,
    }
  }

  const payload = {
    from: formatEmailAddress('Connect Intel', fromMeta.mailbox),
    to: [content.normalizedTo],
    subject: content.subject,
    html: content.html,
    text: content.text,
  }
  if (inviterEmail?.includes('@')) payload.reply_to = inviterEmail

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data?.message || data?.error?.message || `Resend error (${response.status})`
    throw new Error(detail)
  }

  let deliveryStatus = null
  if (data.id) {
    const statusCheck = await getResendEmailStatus(data.id)
    if (statusCheck.ok) {
      deliveryStatus =
        statusCheck.email?.last_event || statusCheck.email?.status || statusCheck.email?.delivery_status
    }
  }

  return {
    sent: true,
    id: data.id,
    provider: 'resend',
    from: payload.from,
    to: content.normalizedTo,
    replyTo: inviterEmail || null,
    resendDomainStatus: domainStatus.status,
    deliveryStatus,
  }
}

export async function sendTeamInviteEmail({
  to,
  inviterName,
  inviterEmail,
  organizationName,
  organizationId,
  inviteUrl,
  roleLabel,
  existingAccount = false,
}) {
  const fromMeta = buildInviteFromHeader({ inviterName, inviterEmail, organizationName })
  let orgOAuth = null
  if (organizationId) {
    const { readStore } = await import('./store.js')
    const store = await readStore()
    orgOAuth = resolveInviteGmailOAuthForOrg(store, organizationId)
  }

  const content = buildInviteEmailContent({
    to,
    inviterName,
    inviterEmail,
    organizationName,
    inviteUrl,
    roleLabel,
    existingAccount,
  })

  if (!content.normalizedTo.includes('@')) {
    return { sent: false, error: 'Invalid recipient email address.' }
  }

  const provider = await resolveActiveProvider(fromMeta, orgOAuth)

  if (provider === 'gmail_oauth') {
    const result = await sendViaGmailOAuth({
      refreshToken: orgOAuth.refreshToken,
      from: fromMeta.from,
      to: content.normalizedTo,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: inviterEmail,
    })
    return { ...result, from: fromMeta.from, to: content.normalizedTo, mailbox: orgOAuth.email }
  }

  if (provider === 'gmail') {
    const result = await sendViaGmailSmtp({
      from: fromMeta.from,
      to: content.normalizedTo,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: inviterEmail,
    })
    return { ...result, from: fromMeta.from, to: content.normalizedTo }
  }

  if (provider === 'resend') {
    try {
      return await sendViaResend({ fromMeta, content, inviterEmail })
    } catch (error) {
      return {
        sent: false,
        error: error.message,
        provider: 'resend',
        from: fromMeta.from,
        to: content.normalizedTo,
      }
    }
  }

  const gmailHint = getGmailSetupHint()
  const resendDomain = isResendConfigured()
    ? await getResendDomainSendStatus(fromMeta.mailbox)
    : { status: 'not_configured', hint: null }

  const connectHint = isGmailOAuthConfigured()
    ? `Team → Connect invite@connectintel.net (sign in with invite@ only). Resend DNS is not required.`
    : 'Add GOOGLE_CLIENT_SECRET on Vercel, redeploy, then connect invite@ on Team page.'

  return {
    sent: false,
    error: 'Invite email is not set up — email was not sent.',
    hint: connectHint,
    provider: 'none',
    from: fromMeta.from,
    to: content.normalizedTo,
    resendDomainStatus: resendDomain.status,
    gmailSetup: gmailHint,
    recommendedProvider: 'gmail',
  }
}

export async function sendInviteTestToSelf({
  inviterName,
  inviterEmail,
  organizationName,
  organizationId,
}) {
  const to = String(inviterEmail || '').trim().toLowerCase()
  if (!to) return { sent: false, error: 'Your account has no email address.' }

  return sendTeamInviteEmail({
    to,
    inviterName,
    inviterEmail,
    organizationName,
    organizationId,
    inviteUrl: getAppBaseUrl(),
    roleLabel: 'Test',
    existingAccount: false,
  })
}

export async function getInviteEmailDiagnostics(organizationId = null) {
  const fromMeta = buildInviteFromHeader({
    inviterName: 'Preview',
    organizationName: 'Your company',
  })

  const { readStore } = await import('./store.js')
  const store = await readStore()
  const orgOAuth = resolveInviteGmailOAuthForOrg(store, organizationId)
  const platformMeta = store.platform?.[0] || {}

  const provider = await resolveActiveProvider(fromMeta, orgOAuth)
  const gmailOAuthConfigured = isGmailOAuthConfigured()
  const gmailConfigured = isGmailSmtpConfigured()
  const gmailHint = getGmailSetupHint()

  let resendDomain = { canSend: false, status: 'not_checked', hint: null }
  let resendDnsRecords = null

  if (isResendConfigured() && fromMeta.mailbox) {
    resendDomain = await getResendDomainSendStatus(fromMeta.mailbox)
    const details = await getResendDomainDetails(
      resendDomain.domain || mailboxDomain(fromMeta.mailbox) || 'connectintel.net'
    )
    if (details.ok) resendDnsRecords = details.records
  } else if (!isResendConfigured()) {
    resendDomain = { canSend: false, status: 'no_api_key', hint: null }
  }

  const inviteEmailReady = provider !== 'none'
  const companyOnly = useCompanyInviteMailbox(fromMeta)
  const hint =
    provider === 'gmail_oauth' || provider === 'gmail' || provider === 'resend'
      ? null
      : companyOnly && gmailOAuthConfigured
        ? `Click "Connect ${COMPANY_MAILBOX}" below — sign in once with that Google account. No DNS.`
        : companyOnly
          ? `Complete DNS for connectintel.net (below), then Verify in Resend. Status: ${resendDomain.status}.`
          : fromMeta.hint || resendDomain.hint || null

  return {
    activeProvider: provider,
    oauthRedirectUri: getGmailOAuthRedirectUri(),
    appBaseUrl: getOAuthRedirectBaseUrl(),
    lastOAuthError: platformMeta.lastOAuthError || null,
    lastOAuthErrorAt: platformMeta.lastOAuthErrorAt || null,
    companyMailboxOnly: companyOnly,
    recommendedProvider: orgOAuth?.refreshToken ? 'gmail_oauth' : gmailOAuthConfigured ? 'gmail_oauth' : 'resend',
    gmailOAuthConfigured,
    companyMailboxConnected: Boolean(orgOAuth?.refreshToken),
    connectedMailbox: orgOAuth?.email || null,
    connectedViaEnv: orgOAuth?.source === 'env',
    rootSpfRecord: ROOT_SPF_RECORD,
    gmailConfigured: companyOnly ? false : gmailConfigured,
    gmailSetup: companyOnly ? null : gmailHint,
    resendConfigured: isResendConfigured(),
    fromAddress: fromMeta.from,
    mailbox: fromMeta.mailbox,
    resendDomain: resendDomain.domain || 'connectintel.net',
    resendDomainStatus: resendDomain.status,
    resendDomainVerified: resendDomain.canSend,
    inviteEmailReady,
    appUrl: getAppBaseUrl(),
    hint,
    dnsProvider: 'Google Domains (now Squarespace Domains)',
    dnsProviderUrl: 'https://domains.squarespace.com',
    dnsLoginNote:
      'You bought connectintel.net on Google Domains. Log in at domains.squarespace.com with the same Google account.',
    resendDnsRecords,
    setupSteps: orgOAuth?.refreshToken
      ? [`Sending from ${orgOAuth.email} via Google.`]
      : gmailOAuthConfigured
        ? [`Click Connect ${COMPANY_MAILBOX} on this page and sign in with that account.`]
        : buildDnsSetupSteps(resendDomain.status, resendDnsRecords),
  }
}

function buildDnsSetupSteps(status, records) {
  if (status === 'verified') {
    return ['Resend verified — click Send test invite on Team page.']
  }

  return [
    'Open https://domains.squarespace.com → Continue with Google → connectintel.net → DNS',
    `Edit @ TXT to: ${ROOT_SPF_RECORD}`,
    `Add ${records?.length || 3} DNS records from the table (Resend)`,
    'Open https://resend.com/domains → connectintel.net → Verify DNS records',
    'Wait 10–30 min → Team → Re-check status → Send test invite to invite@connectintel.net',
  ]
}

export async function verifyInviteDomainInResend(mailbox) {
  const domain = mailboxDomain(mailbox)
  if (!domain) return { ok: false, error: 'Invalid mailbox' }
  return triggerResendDomainVerify(domain)
}
