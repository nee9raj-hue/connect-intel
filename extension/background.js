import { API_BASE, SESSION_COOKIE } from './lib/api.js'

chrome.runtime.onInstalled.addListener(() => {
  console.log('Connect Intel extension installed')
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GMAIL_PARTICIPANTS') {
    import('./lib/api.js')
      .then(({ matchLeadsByEmails, logExtensionAction }) =>
        matchLeadsByEmails(message.emails)
          .then(async (result) => {
            if (result.matches?.length) {
              await logExtensionAction('extension.lead_matched', {
                leadId: result.matches[0].leadId,
                metadata: { count: result.matches.length },
              }).catch(() => {})
            }
            return result
          })
      )
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (message?.type === 'OPEN_SIGN_IN') {
    chrome.tabs.create({ url: `${API_BASE}/?extension=1` })
    sendResponse({ ok: true })
    return false
  }

  return false
})

export async function readAuthState() {
  const cookie = await chrome.cookies.get({ url: API_BASE, name: SESSION_COOKIE })
  return { signedIn: Boolean(cookie?.value) }
}
