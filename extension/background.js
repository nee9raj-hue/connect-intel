import {
  API_BASE,
  SESSION_COOKIE,
  extensionBootstrap,
  logExtensionAction,
  matchLeadsByEmails,
  syncEmailTrail,
  captureLead,
  generateCrmEmail,
  sendCrmEmail,
} from './lib/api.js'

const GMAIL_URL_PATTERN = 'https://mail.google.com/*'
const LINKEDIN_URL_PATTERN = 'https://*.linkedin.com/in/*'

function isGmailTab(tab) {
  const url = String(tab?.url || tab?.pendingUrl || '')
  return url.includes('mail.google.com')
}

function isLinkedInProfileTab(tab) {
  const url = String(tab?.url || tab?.pendingUrl || '')
  return /linkedin\.com\/in\//i.test(url)
}

async function reloadExtensionTabs() {
  try {
    let tabs = await chrome.tabs.query({ url: [GMAIL_URL_PATTERN, LINKEDIN_URL_PATTERN] })
    if (!tabs.length) {
      tabs = (await chrome.tabs.query({})).filter((t) => isGmailTab(t) || isLinkedInProfileTab(t))
    }
    await Promise.all(
      tabs.map((tab) => (tab.id ? chrome.tabs.reload(tab.id).catch(() => {}) : Promise.resolve()))
    )
  } catch (err) {
    console.warn('Connect Intel: could not reload extension tabs', err?.message || err)
  }
}

async function reloadGmailTabs() {
  return reloadExtensionTabs()
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Connect Intel extension', details.reason)
  if (details.reason === 'update' || details.reason === 'install') {
    void reloadGmailTabs()
  }
})

chrome.runtime.onStartup.addListener(() => {
  void reloadGmailTabs()
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

  if (message?.type === 'CI_CAPTURE_LEAD') {
    captureLead(message.fields || {})
      .then((result) => reply(sendResponse, { ok: true, result }))
      .catch((err) => reply(sendResponse, { ok: false, error: err.message }))
    return true
  }

  if (message?.type === 'CI_GENERATE_EMAIL') {
    generateCrmEmail(message.leadId, message.options || {})
      .then((result) => reply(sendResponse, { ok: true, result }))
      .catch((err) => reply(sendResponse, { ok: false, error: err.message, data: err.data }))
    return true
  }

  if (message?.type === 'CI_SEND_EMAIL') {
    sendCrmEmail(message.leadId, message.payload || {})
      .then((result) => reply(sendResponse, { ok: true, result }))
      .catch((err) => reply(sendResponse, { ok: false, error: err.message, data: err.data }))
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

  if (message?.type === 'CI_RELOAD_GMAIL_TAB' && _sender?.tab?.id) {
    chrome.tabs.reload(_sender.tab.id).catch(() => {})
    reply(sendResponse, { ok: true })
    return false
  }

  return false
})

export async function readAuthState() {
  const cookie = await chrome.cookies.get({ url: API_BASE, name: SESSION_COOKIE })
  return { signedIn: Boolean(cookie?.value) }
}
