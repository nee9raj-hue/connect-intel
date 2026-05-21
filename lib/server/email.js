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

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

export async function sendTeamInviteEmail({ to, inviterName, organizationName, inviteUrl, roleLabel }) {
  if (!isResendConfigured()) {
    return { sent: false, reason: 'RESEND_API_KEY or EMAIL_FROM not configured' }
  }

  const subject = `${inviterName || 'Your admin'} invited you to ${organizationName} on Connect Intel`
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#242424;margin:0 0 12px">Join ${organizationName}</h2>
      <p style="color:#444;line-height:1.5">
        ${inviterName || 'Your company admin'} invited you as <strong>${roleLabel}</strong> on Connect Intel —
        shared pipeline CRM and B2B lead search for India.
      </p>
      <p style="margin:24px 0">
        <a href="${inviteUrl}" style="background:#ffcb2b;color:#242424;padding:12px 20px;border-radius:8px;font-weight:600;text-decoration:none;display:inline-block">
          Accept invitation
        </a>
      </p>
      <p style="color:#888;font-size:12px">Link expires in 7 days. Sign in with the same email this invite was sent to.</p>
      <p style="color:#aaa;font-size:11px;word-break:break-all">${inviteUrl}</p>
    </div>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      html,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || data.error || `Email send failed (${response.status})`)
  }

  return { sent: true, id: data.id }
}
