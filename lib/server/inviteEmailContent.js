import { getAppBaseUrl } from './appUrl.js'

export function buildInviteEmailContent({
  to,
  inviterName,
  inviterEmail,
  organizationName,
  inviteUrl,
  roleLabel,
  existingAccount = false,
}) {
  const normalizedTo = String(to || '').trim().toLowerCase()
  const adminName = inviterName || 'Your company admin'
  const org = organizationName || 'your company'
  const ctaUrl = existingAccount ? getAppBaseUrl() : inviteUrl

  const subject = existingAccount
    ? `${adminName} added you to ${org} on Connect Intel`
    : `${adminName} invited you to ${org} on Connect Intel`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#242424;margin:0 0 12px">${existingAccount ? `Welcome to ${org}` : `Join ${org}`}</h2>
      <p style="color:#444;line-height:1.5">${adminName} invited you to <strong>${org}</strong> on Connect Intel.</p>
      <p style="color:#444;line-height:1.5">Sign in with <strong>${normalizedTo}</strong> (same email as this message).</p>
      <p style="margin:24px 0">
        <a href="${ctaUrl}" style="background:#ffcb2b;color:#242424;padding:12px 20px;border-radius:8px;font-weight:600;text-decoration:none;display:inline-block">
          ${existingAccount ? 'Open Connect Intel' : 'Accept invitation'}
        </a>
      </p>
      ${!existingAccount ? '<p style="color:#888;font-size:12px">Link expires in 7 days.</p>' : ''}
      <p style="color:#888;font-size:12px">Reply to this email to reach ${adminName}${inviterEmail ? ` (${inviterEmail})` : ''}.</p>
      ${!existingAccount ? `<p style="color:#aaa;font-size:11px;word-break:break-all">${inviteUrl}</p>` : ''}
    </div>
  `

  const text = existingAccount
    ? `${adminName} added you to ${org} on Connect Intel.\n\nSign in with ${normalizedTo}:\n${getAppBaseUrl()}\n\nReply to ${inviterEmail || adminName}.`
    : `${adminName} invited you to ${org} on Connect Intel as ${roleLabel}.\n\nAccept (sign in with ${normalizedTo}):\n${inviteUrl}\n\nReply to ${inviterEmail || adminName}.`

  return { normalizedTo, adminName, org, subject, html, text, ctaUrl }
}
