import crypto from 'node:crypto'

export function getAppBaseUrl() {
  if (process.env.APP_URL) {
    return String(process.env.APP_URL).replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:5173'
}

export function createInviteToken() {
  return crypto.randomBytes(24).toString('hex')
}

export function buildInviteUrl(token) {
  return `${getAppBaseUrl()}/?invite=${encodeURIComponent(token)}`
}

/** Resend needs API key; EMAIL_FROM optional (falls back to Resend test sender). */
export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}

function getVerifiedFromAddress() {
  const configured = String(process.env.EMAIL_FROM || '').trim()
  if (configured) return configured
  return 'Connect Intel <onboarding@resend.dev>'
}

/**
 * From header: admin's name + company (verified domain in EMAIL_FROM).
 * Reply-To: admin's Google email so replies go to the inviter.
 */
export function buildInviteFromHeader({ inviterName, inviterEmail, organizationName }) {
  const configured = getVerifiedFromAddress()
  const match = configured.match(/^(.+?)\s*<([^>]+)>$/)

  const inviterLabel = [inviterName, organizationName].filter(Boolean).join(' · ') || 'Connect Intel'
  const mailbox = match ? match[2].trim() : configured.includes('@') ? configured : 'onboarding@resend.dev'

  return `${inviterLabel} <${mailbox}>`
}

async function postResendEmail(payload) {
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
    const detail = data.message || data.error || JSON.stringify(data)
    throw new Error(typeof detail === 'string' ? detail : `Email send failed (${response.status})`)
  }

  return { sent: true, id: data.id }
}

export async function sendTeamInviteEmail({
  to,
  inviterName,
  inviterEmail,
  organizationName,
  inviteUrl,
  roleLabel,
  existingAccount = false,
}) {
  if (!isResendConfigured()) {
    return {
      sent: false,
      reason: 'RESEND_API_KEY is not set on the server (Vercel → Environment Variables).',
    }
  }

  const from = buildInviteFromHeader({ inviterName, inviterEmail, organizationName })
  const replyTo = inviterEmail ? [inviterEmail] : undefined
  const adminName = inviterName || 'Your company admin'
  const org = organizationName || 'your company'

  const subject = existingAccount
    ? `${adminName} added you to ${org} on Connect Intel`
    : `${adminName} invited you to ${org} on Connect Intel`

  const intro = existingAccount
    ? `<p style="color:#444;line-height:1.5">${adminName} (<a href="mailto:${inviterEmail || '#'}">${inviterEmail || 'your admin'}</a>) added you to <strong>${org}</strong> on Connect Intel. Sign in with <strong>${to}</strong> to open your shared pipeline.</p>`
    : `<p style="color:#444;line-height:1.5">${adminName} (<a href="mailto:${inviterEmail || '#'}">${inviterEmail || 'your admin'}</a>) invited you as <strong>${roleLabel}</strong> on Connect Intel — shared pipeline CRM and B2B lead search for India.</p>
      <p style="color:#444;line-height:1.5">Sign in with <strong>${to}</strong> (same email as this message).</p>`

  const ctaLabel = existingAccount ? 'Open Connect Intel' : 'Accept invitation'
  const ctaUrl = existingAccount ? getAppBaseUrl() : inviteUrl

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#242424;margin:0 0 12px">${existingAccount ? `Welcome to ${org}` : `Join ${org}`}</h2>
      ${intro}
      <p style="margin:24px 0">
        <a href="${ctaUrl}" style="background:#ffcb2b;color:#242424;padding:12px 20px;border-radius:8px;font-weight:600;text-decoration:none;display:inline-block">
          ${ctaLabel}
        </a>
      </p>
      ${!existingAccount ? '<p style="color:#888;font-size:12px">Link expires in 7 days.</p>' : ''}
      <p style="color:#888;font-size:12px">Reply to this email to reach ${adminName} directly.</p>
      ${!existingAccount ? `<p style="color:#aaa;font-size:11px;word-break:break-all">${inviteUrl}</p>` : ''}
    </div>
  `

  try {
    return await postResendEmail({
      from,
      to: [to],
      reply_to: replyTo,
      subject,
      html,
    })
  } catch (error) {
    return { sent: false, error: error.message }
  }
}
