import { formatEmailAddress, isPersonalEmailMailbox } from './email.js'
import { getOrganization } from './organizations.js'
import {
  createResendDomain,
  getResendDomainDetails,
  getResendDomainSendStatus,
  mailboxDomain,
  sendResendEmail,
  triggerResendDomainVerify,
} from './resend.js'
import { crmOutboundReplyTo } from './crmInboundEmail.js'
import { readStore, updateStore, updateStorePartial } from './store.js'

export function inferCompanyDomain(user) {
  const email = String(user?.email || '').trim().toLowerCase()
  if (!email.includes('@') || isPersonalEmailMailbox(email)) return null
  return mailboxDomain(email)
}

export function normalizeOrgEmailDomain(org) {
  const raw = org?.emailDomain
  if (!raw?.name) return null
  return {
    name: String(raw.name).toLowerCase(),
    resendId: raw.resendId || null,
    status: raw.status || 'pending',
    records: Array.isArray(raw.records) ? raw.records : [],
    verifiedAt: raw.verifiedAt || null,
    updatedAt: raw.updatedAt || null,
    autoSetupAt: raw.autoSetupAt || null,
  }
}

export async function refreshOrgEmailDomainFromResend(org) {
  const config = normalizeOrgEmailDomain(org)
  if (!config?.name) return { ok: false, error: 'No domain configured' }

  const details = await getResendDomainDetails(config.name)
  if (!details.ok) {
    return { ok: false, error: details.error, domain: config.name }
  }

  const sendStatus = await getResendDomainSendStatus(`noreply@${config.name}`)
  const status = sendStatus.canSend ? 'verified' : details.status || sendStatus.status

  return {
    ok: true,
    domain: config.name,
    resendId: details.id,
    status,
    records: details.records || config.records,
    canSend: sendStatus.canSend,
    verifiedAt: sendStatus.canSend ? new Date().toISOString() : config.verifiedAt,
  }
}

export async function setupOrgEmailDomain(organizationId, domainName) {
  const domain = String(domainName || '').toLowerCase().trim()
  if (!domain || !domain.includes('.')) {
    throw new Error('Use your company domain (e.g. alvarfresh.com), not Gmail or Yahoo.')
  }

  const created = await createResendDomain(domain)
  if (!created.ok) {
    throw new Error(created.error || 'Could not register domain with email provider')
  }

  const now = new Date().toISOString()
  await updateStore((draft) => {
    const org = getOrganization(draft, organizationId)
    if (!org) throw new Error('Organization not found')
    org.emailDomain = {
      name: domain,
      resendId: created.id || null,
      status: created.status || 'pending',
      records: created.records || [],
      verifiedAt: null,
      updatedAt: now,
      autoSetupAt: now,
    }
    return draft
  })

  const store = await readStore()
  const org = getOrganization(store, organizationId)
  return buildOrgEmailDomainResponse(org, { justCreated: Boolean(created.created) })
}

export async function verifyOrgEmailDomain(organizationId) {
  const store = await readStore()
  const org = getOrganization(store, organizationId)
  const config = normalizeOrgEmailDomain(org)
  if (!config?.name) throw new Error('Set up your company domain first')

  await triggerResendDomainVerify(config.name)
  const refreshed = await refreshOrgEmailDomainFromResend(org)

  if (refreshed.ok) {
    await updateStore((draft) => {
      const o = getOrganization(draft, organizationId)
      if (!o?.emailDomain) return draft
      o.emailDomain = {
        ...o.emailDomain,
        resendId: refreshed.resendId || o.emailDomain.resendId,
        status: refreshed.status,
        records: refreshed.records || o.emailDomain.records,
        verifiedAt: refreshed.verifiedAt || o.emailDomain.verifiedAt,
        updatedAt: new Date().toISOString(),
      }
      return draft
    })
  }

  const after = await readStore()
  return buildOrgEmailDomainResponse(getOrganization(after, organizationId), {
    verifyTriggered: true,
  })
}

export function userCanSendOnOrgDomain(user, org) {
  const config = normalizeOrgEmailDomain(org)
  if (!config?.name || config.status !== 'verified') {
    return { canSend: false, reason: 'domain_not_verified', domain: config?.name || null }
  }
  const userDomain = mailboxDomain(user.email)
  if (userDomain !== config.name) {
    return {
      canSend: false,
      reason: 'email_domain_mismatch',
      domain: config.name,
      hint: `Sign in with your company address @${config.name} (you are on @${userDomain || '?'}).`,
    }
  }
  return { canSend: true, domain: config.name }
}

export function buildOrgEmailDomainResponse(org, extra = {}) {
  const config = normalizeOrgEmailDomain(org)
  const canSend = config?.status === 'verified'
  return {
    configured: Boolean(config),
    domain: config?.name || null,
    status: config?.status || 'not_configured',
    records: config?.records || [],
    verified: canSend,
    canSendCrmEmail: canSend,
    ...extra,
  }
}

export async function getOrgEmailDomainStatusForUser(user) {
  if (!user?.organizationId) {
    return {
      ...buildOrgEmailDomainResponse(null),
      hint: 'Company account required for automated outbound email.',
    }
  }

  const store = await readStore({ only: ['organizations'] })
  const org = getOrganization(store, user.organizationId)
  let config = normalizeOrgEmailDomain(org)

  if (config) {
    const refreshed = await refreshOrgEmailDomainFromResend(org)
    if (refreshed.ok && refreshed.status !== config.status) {
      await updateStorePartial(['organizations'], (draft) => {
        const o = getOrganization(draft, user.organizationId)
        if (!o?.emailDomain) return draft
        o.emailDomain.status = refreshed.status
        o.emailDomain.records = refreshed.records || o.emailDomain.records
        o.emailDomain.resendId = refreshed.resendId || o.emailDomain.resendId
        if (refreshed.verifiedAt) o.emailDomain.verifiedAt = refreshed.verifiedAt
        o.emailDomain.updatedAt = new Date().toISOString()
        return draft
      })
      const after = await readStore({ only: ['organizations'] })
      config = normalizeOrgEmailDomain(getOrganization(after, user.organizationId))
    }
  }

  const orgAfter = getOrganization(
    await readStore({ only: ['organizations'] }),
    user.organizationId
  )
  const sendCheck = userCanSendOnOrgDomain(user, orgAfter)
  const base = buildOrgEmailDomainResponse(orgAfter)

  let hint = null
  if (!base.configured) {
    hint = 'Your admin enables one-click domain setup under Team → Outbound email.'
  } else if (!base.verified) {
    hint = `Add the DNS records below at your domain host, then click Check verification.`
  } else if (!sendCheck.canSend) {
    hint = sendCheck.hint
  }

  return {
    ...base,
    userCanSend: sendCheck.canSend,
    sendBlockReason: sendCheck.reason || null,
    hint,
    inferredDomain: inferCompanyDomain(user),
  }
}

/** Auto-register company domain when admin opens setup (no Google test users). */
export async function autoSetupOrgEmailDomainIfNeeded(user) {
  if (user?.orgRole !== 'org_admin' && user?.role !== 'admin') return null
  if (!user.organizationId) return null

  const domain = inferCompanyDomain(user)
  if (!domain) {
    return {
      ok: false,
      error: 'Use a company Google account (e.g. sales@yourcompany.com), not @gmail.com.',
    }
  }

  const store = await readStore({ only: ['organizations'] })
  const org = getOrganization(store, user.organizationId)
  const existing = normalizeOrgEmailDomain(org)
  if (existing?.name === domain) {
    return getOrgEmailDomainStatusForUser(user)
  }
  if (existing?.name && existing.name !== domain) {
    return {
      ok: false,
      error: `This workspace is already set up for ${existing.name}. Contact support to change domains.`,
    }
  }

  await setupOrgEmailDomain(user.organizationId, domain)
  return getOrgEmailDomainStatusForUser(user)
}

export async function sendCrmEmailViaOrgResend({ user, lead, subject, body, org, cc, attachments, htmlAppend, html }) {
  const check = userCanSendOnOrgDomain(user, org)
  if (!check.canSend) {
    return { sent: false, error: check.hint || 'Company email is not ready to send yet.', ...check }
  }

  const to = String(lead.email || '').trim().toLowerCase()
  if (!to.includes('@')) {
    return { sent: false, error: 'This lead has no email address on file.' }
  }

  const from = formatEmailAddress(user.name || user.email, user.email)
  const text = String(body || '').trim()
  let htmlOut = html ? String(html) : text.replace(/\n/g, '<br>\n')
  if (htmlAppend) htmlOut += htmlAppend

  const inboundReply = crmOutboundReplyTo(lead?.id || lead?.lead?.id)
  const result = await sendResendEmail({
    from,
    to,
    subject: String(subject || '').trim(),
    html: htmlOut,
    text,
    replyTo: inboundReply || user.email,
    cc: cc?.length ? cc : undefined,
    attachments: attachments?.length ? attachments : undefined,
  })

  if (!result.sent) {
    return { sent: false, error: result.error || 'Send failed' }
  }

  return {
    ...result,
    mailbox: user.email,
    provider: 'org_resend',
  }
}
