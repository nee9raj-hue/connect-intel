import { formatMailboxFrom, sendViaGmailOAuth } from './gmailOAuth.js'
import { readStore, updateStore, updateStorePartial } from './store.js'
import { crmOutboundReplyTo, createCrmOutboundMessageId } from './crmInboundEmail.js'

export function getUserCrmGmail(user) {
  const oauth = user?.crmGmailOAuth
  if (oauth?.refreshToken && oauth?.email) return oauth
  return null
}

export async function saveUserCrmGmailOAuth(userId, oauth) {
  await updateStorePartial(['users'], (draft) => {
    const user = draft.users.find((u) => u.id === userId)
    if (!user) throw new Error('User not found')
    user.crmGmailOAuth = {
      refreshToken: oauth.refreshToken,
      email: oauth.email,
      connectedAt: oauth.connectedAt,
      scope: oauth.scope || null,
    }
    if (oauth.googleSub) user.googleSub = oauth.googleSub
    return draft
  })
}

export async function loadUserCrmGmailFromStore(userId) {
  const store = await readStore()
  const user = store.users.find((u) => u.id === userId)
  return getUserCrmGmail(user)
}

function isRevokedGmailTokenError(message) {
  const text = String(message || '').toLowerCase()
  return (
    text.includes('invalid_grant') ||
    text.includes('token has been expired or revoked') ||
    text.includes('revoked') ||
    text.includes('invalid_rapt')
  )
}

async function clearUserCrmGmailOAuth(userId) {
  if (!userId) return
  await updateStorePartial(['users'], (draft) => {
    const user = draft.users.find((u) => u.id === userId)
    if (!user) return draft
    user.crmGmailOAuth = null
    return draft
  })
}

export async function sendCrmEmailFromUserMailbox({ user, lead, subject, body, cc, attachments, htmlAppend, html }) {
  const oauth = getUserCrmGmail(user)
  if (!oauth) {
    return {
      sent: false,
      error: 'Connect your work Gmail first (open Work email in the Workspace section).',
      needsGmailConnect: true,
    }
  }

  const to = String(lead.email || '').trim().toLowerCase()
  if (!to.includes('@')) {
    return { sent: false, error: 'This lead has no email address on file.' }
  }

  const from = formatMailboxFrom(user.name || user.email, oauth.email)
  const text = String(body || '').trim()
  const htmlOut = html ? String(html) + (htmlAppend || '') : text.replace(/\n/g, '<br>\n') + (htmlAppend || '')

  const leadId = lead?.id || lead?.lead?.id
  const inboundReply = crmOutboundReplyTo(leadId)
  const messageId = inboundReply ? createCrmOutboundMessageId() : null
  const replyTo = inboundReply || oauth.email

  const result = await sendViaGmailOAuth({
    refreshToken: oauth.refreshToken,
    from,
    to,
    subject: String(subject || '').trim(),
    html: htmlOut,
    text,
    replyTo,
    cc: cc?.length ? cc : undefined,
    attachments: attachments?.length ? attachments : undefined,
    messageId,
  })

  if (!result.sent && isRevokedGmailTokenError(result.error)) {
    await clearUserCrmGmailOAuth(user.id)
    return {
      sent: false,
      provider: 'crm_gmail',
      mailbox: oauth.email,
      needsGmailConnect: true,
      needsGmailReconnect: true,
      error:
        'Your Work Gmail connection expired after Google OAuth changes. Open Work email in the sidebar, disconnect Gmail, then connect again.',
    }
  }

  return {
    ...result,
    from,
    mailbox: oauth.email,
    provider: 'crm_gmail',
  }
}
