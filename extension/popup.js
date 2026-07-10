import {
  extensionBootstrap,
  logExtensionAction,
  matchLeadsByEmails,
  syncEmailTrail,
  captureLead,
  API_BASE,
} from './lib/api.js'

const statusEl = document.getElementById('status')
const leadEl = document.getElementById('lead')
const actionsEl = document.getElementById('actions')
const signInEl = document.getElementById('signIn')
const subtitleEl = document.getElementById('subtitle')
const primaryActionEl = document.getElementById('primaryAction')

let currentLead = null
let mode = 'idle'
let captureFields = null

function setStatus(html, className = 'muted') {
  statusEl.innerHTML = html
  statusEl.className = `card ${className}`
}

function excludeEmailsForUser(boot) {
  return [boot?.user?.email, boot?.integrations?.workGmailEmail]
    .map((e) => String(e || '').trim().toLowerCase())
    .filter((e) => e.includes('@'))
}

async function readActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab || null
}

function detectMode(url = '') {
  if (String(url).includes('mail.google.com')) return 'gmail'
  if (/linkedin\.com\/in\//i.test(url)) return 'linkedin'
  return 'capture'
}

async function loadGmailContext(tab) {
  if (!tab?.id) return { emails: [], subject: '', recipientNames: [] }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.__connectIntelExtractGmail?.() || { emails: [], subject: '', recipientNames: [] },
    })
    return result || { emails: [], subject: '', recipientNames: [] }
  } catch {
    return { emails: [], subject: '', recipientNames: [] }
  }
}

async function loadPageCapture(tab) {
  if (!tab?.id) return null
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/linkedinCaptureParse.js', 'lib/contactPageParse.js', 'lib/pageCapture.js'],
      func: async () => {
        const ready = globalThis.__connectIntelExtractPageReady
        const snap = globalThis.__connectIntelExtractPage
        if (typeof ready === 'function') return ready()
        if (typeof snap === 'function') return snap()
        return null
      },
    })
    return result || null
  } catch {
    return null
  }
}

function renderLeadCard(match) {
  currentLead = match
  leadEl.hidden = false
  leadEl.innerHTML = `
    <div class="lead">${match.name}</div>
    <div class="muted">${match.company || ''}${match.company && match.email ? ' · ' : ''}${match.email || ''}</div>
    <div class="muted">Status: ${match.status || '—'}</div>
  `
  actionsEl.hidden = false
}

function renderCapturePreview(fields) {
  captureFields = fields
  const name = [fields.firstName, fields.lastName].filter(Boolean).join(' ')
  const location = fields.location || [fields.city, fields.state].filter(Boolean).join(', ')
  leadEl.hidden = false
  leadEl.innerHTML = `
    <div class="lead">${name || fields.company || 'New lead'}</div>
    <div class="muted">${fields.title || ''}</div>
    <div class="muted">${fields.company || ''}</div>
    <div class="muted">${location || ''}</div>
    <div class="muted">${fields.email || ''}</div>
    <div class="muted">${fields.phone || ''}</div>
    <div class="muted">${fields.linkedin || ''}</div>
    ${fields.notes ? `<div class="muted">${fields.notes.split('\n').slice(0, 3).join(' · ')}</div>` : ''}
  `
  actionsEl.hidden = false
  primaryActionEl.textContent = 'Add / update pipeline'
}

async function initGmail(boot) {
  subtitleEl.textContent = 'Gmail thread match · trail sync'
  mode = 'gmail'
  primaryActionEl.textContent = 'Sync email trail'

  const tab = await readActiveTab()
  const context = await loadGmailContext(tab)
  const excludeEmails = excludeEmailsForUser(boot)
  const hasSignals =
    (context.emails?.length || 0) > 0 ||
    String(context.subject || '').trim().length >= 2 ||
    (context.recipientNames?.length || 0) > 0

  if (!hasSignals) {
    setStatus(
      `Signed in as <strong>${boot.user.name || boot.user.email}</strong><br/>` +
        '<span class="muted">Open a Gmail thread to match a pipeline lead.</span>',
      'ok'
    )
    return
  }

  const { matches, searchQuery, matchedBy } = await matchLeadsByEmails({
    emails: context.emails || [],
    excludeEmails,
    subject: context.subject || '',
    recipientNames: context.recipientNames || [],
    domainHints: context.domainHints || [],
  })

  if (!matches?.length) {
    const participantHint = (context.emails || [])
      .filter((e) => !excludeEmails.includes(String(e).toLowerCase()))
      .slice(0, 3)
      .join(', ')
    setStatus(
      `No pipeline lead matched this thread.<br/><span class="muted">${[participantHint, searchQuery, context.subject].filter(Boolean).join(' · ')}</span>`,
      'muted'
    )
    return
  }

  renderLeadCard(matches[0])
  if (matches.length > 1) {
    setStatus(`Matched ${matches.length} leads — showing top match`, 'ok')
  } else if (matchedBy === 'search') {
    setStatus(`Matched via search${searchQuery ? `: ${searchQuery}` : ''}`, 'ok')
  } else {
    setStatus(`Signed in as <strong>${boot.user.name || boot.user.email}</strong>`, 'ok')
  }
}

async function initCapture(boot, pageMode) {
  mode = 'capture'
  primaryActionEl.textContent = 'Add / update pipeline'

  const tab = await readActiveTab()
  const fields = await loadPageCapture(tab)

  subtitleEl.textContent =
    pageMode === 'linkedin'
      ? 'LinkedIn profile capture'
      : fields?.pageType === 'contact_page'
        ? 'Contact page capture'
        : 'Add current page to pipeline'

  setStatus(`Signed in as <strong>${boot.user.name || boot.user.email}</strong>`, 'ok')

  if (!fields) {
    setStatus(
      'Could not read this page.<br/><span class="muted">Open a contact/team page, company site, or LinkedIn profile.</span>',
      'muted'
    )
    return
  }

  renderCapturePreview(fields)
}

async function init() {
  try {
    const tab = await readActiveTab()
    const pageMode = detectMode(tab?.url || '')
    const boot = await extensionBootstrap()
    signInEl.hidden = true

    if (pageMode === 'gmail') {
      await initGmail(boot)
      return
    }

    await initCapture(boot, pageMode)
  } catch (err) {
    if (err.message === 'not_signed_in') {
      setStatus('Sign in to use Connect Intel with your CRM pipeline.', 'muted')
      signInEl.hidden = false
      return
    }
    setStatus(err.message || 'Could not load extension', 'error')
  }
}

signInEl.addEventListener('click', () => {
  chrome.tabs.create({ url: `${API_BASE}/?extension=1` })
})

document.getElementById('openApp').addEventListener('click', async () => {
  if (!currentLead?.pipelineUrl) return
  await logExtensionAction('extension.open_in_app', { leadId: currentLead.leadId }).catch(() => {})
  chrome.tabs.create({ url: currentLead.pipelineUrl })
})

primaryActionEl.addEventListener('click', async () => {
  if (mode === 'open') {
    if (!currentLead?.pipelineUrl) return
    chrome.tabs.create({ url: currentLead.pipelineUrl })
    return
  }

  if (mode === 'gmail') {
    if (!currentLead?.leadId) return
    setStatus('Syncing trail mail (server-side)…', 'muted')
    try {
      await logExtensionAction('extension.trail_sync_requested', { leadId: currentLead.leadId })
      const result = await syncEmailTrail(currentLead.leadId)
      await logExtensionAction('extension.trail_sync_completed', {
        leadId: currentLead.leadId,
        metadata: { imported: result.importedCount },
      })
      setStatus(
        `Trail sync done — ${result.importedCount || 0} new message(s), ${result.removedCount || 0} pruned`,
        'ok'
      )
    } catch (err) {
      setStatus(err.data?.error || err.message || 'Sync failed', 'error')
    }
    return
  }

  if (!captureFields) return
  setStatus('Saving to pipeline…', 'muted')
  try {
    await logExtensionAction('extension.lead_capture_requested', {
      metadata: { pageType: captureFields.pageType },
    })
    const result = await captureLead(captureFields)
    currentLead = result.lead
    renderLeadCard(result.lead)
    primaryActionEl.textContent = 'Open in Connect Intel'
    mode = 'open'
    setStatus(result.message || 'Lead added to pipeline', 'ok')
  } catch (err) {
    setStatus(err.data?.error || err.message || 'Capture failed', 'error')
  }
})

init()
