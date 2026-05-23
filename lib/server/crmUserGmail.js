import { formatMailboxFrom, sendViaGmailOAuth } from './gmailOAuth.js'
import { readStore, updateStore } from './store.js'

export function getUserCrmGmail(user) {
  const oauth = user?.crmGmailOAuth
  if (oauth?.refreshToken && oauth?.email) return oauth
  return null
}

export async function saveUserCrmGmailOAuth(userId, oauth) {
  await updateStore((draft) => {
    const user = draft.users.find((u) => u.id === userId)
    if (!user) throw new Error('User not found')
    user.crmGmailOAuth = {
      refreshToken: oauth.refreshToken,
      email: oauth.email,
      connectedAt: oauth.connectedAt,
    }
    return draft
  })
}

export async function loadUserCrmGmailFromStore(userId) {
  const store = await readStore()
  const user = store.users.find((u) => u.id === userId)
  return getUserCrmGmail(user)
}

export async function sendCrmEmailFromUserMailbox({ user, lead, subject, body }) {
  const oauth = getUserCrmGmail(user)
  if (!oauth) {
    return {
      sent: false,
      error: 'Connect your work Gmail first (Email tab → Connect Gmail).',
      needsGmailConnect: true,
    }
  }

  const to = String(lead.email || '').trim().toLowerCase()
  if (!to.includes('@')) {
    return { sent: false, error: 'This lead has no email address on file.' }
  }

  const from = formatMailboxFrom(user.name || user.email, oauth.email)
  const text = String(body || '').trim()
  const html = text.replace(/\n/g, '<br>\n')

  const result = await sendViaGmailOAuth({
    refreshToken: oauth.refreshToken,
    from,
    to,
    subject: String(subject || '').trim(),
    html,
    text,
    replyTo: oauth.email,
  })

  return {
    ...result,
    from,
    mailbox: oauth.email,
    provider: 'crm_gmail',
  }
}
