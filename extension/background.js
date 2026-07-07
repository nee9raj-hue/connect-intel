import {
  API_BASE,
  SESSION_COOKIE,
  extensionBootstrap,
  logExtensionAction,
  matchLeadsByEmails,
  syncEmailTrail,
} from './lib/api.js'

chrome.runtime.onInstalled.addListener(() => {
  console.log('Connect Intel extension installed')
})

function excludeEmailsForBoot(boot) {
  return [boot?.user?.email, boot?.integrations?.workGmailEmail]
    .map((e) => String(e || '').trim().toLowerCase())
    .filter((e) => e.includes('@'))
}

async function matchThreadContext(context = {}) {
  const hasSignal =
    (context.emails?.length || 0) > 0 ||
    String(context.subject || '').trim().length >= 2 ||
    (context.recipientNames?.length || 0) > 0 ||
    (context.domainHints?.length || 0) > 0
  if (!hasSignal) {
    return { matches: [], emails: [], searchQuery: '', matchedBy: null }
  }

  const boot = await extensionBootstrap()
  const result = await matchLeadsByEmails({
    emails: context.emails || [],
    excludeEmails: excludeEmailsForBoot(boot),
    subject: context.subject || '',
    recipientNames: context.recipientNames || [],
    domainHints: context.domainHints || [],
  })
  if (result.matches?.length) {
    await logExtensionAction('extension.lead_matched', {
      leadId: result.matches[0].leadId,
      metadata: { count: result.matches.length },
    }).catch(() => {})
  }
  return result
}

function reply(sendResponse, payload) {
  try {
    sendResponse(payload)
  } catch {
    /* message channel may already be closed */
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GMAIL_PARTICIPANTS') {
    matchThreadContext(message)
      .then((result) => reply(sendResponse, { ok: true, result }))
      .catch((err) => reply(sendResponse, { ok: false, error: err.message }))
    return true
  }

  if (message?.type === 'CI_BOOTSTRAP') {
    extensionBootstrap()
      .then((result) => reply(sendResponse, { ok: true, result }))
      .catch((err) => reply(sendResponse, { ok: false, error: err.message }))
    return true
  }

  if (message?.type === 'CI_MATCH_THREAD') {
    matchThreadContext(message.context || {})
      .then((result) => reply(sendResponse, { ok: true, result }))
      .catch((err) => reply(sendResponse, { ok: false, error: err.message }))
    return true
  }

  if (message?.type === 'CI_SYNC_TRAIL') {
    syncEmailTrail(message.leadId)
      .then((result) => reply(sendResponse, { ok: true, result }))
      .catch((err) => reply(sendResponse, { ok: false, error: err.message }))
    return true
  }

  if (message?.type === 'CI_LOG') {
    logExtensionAction(message.action, {
      leadId: message.leadId || null,
      metadata: message.metadata || {},
    })
      .then((result) => reply(sendResponse, { ok: true, result }))
      .catch((err) => reply(sendResponse, { ok: false, error: err.message }))
    return true
  }

  if (message?.type === 'OPEN_SIGN_IN') {
    chrome.tabs.create({ url: `${API_BASE}/?extension=1` })
    reply(sendResponse, { ok: true })
    return false
  }

  if (message?.type === 'OPEN_TAB' && message.url) {
    chrome.tabs.create({ url: message.url })
    reply(sendResponse, { ok: true })
    return false
  }

  return false
})

export async function readAuthState() {
  const cookie = await chrome.cookies.get({ url: API_BASE, name: SESSION_COOKIE })
  return { signedIn: Boolean(cookie?.value) }
}
