import {
  extensionBootstrap,
  logExtensionAction,
  matchLeadsByEmails,
  syncEmailTrail,
  API_BASE,
} from './lib/api.js'

const statusEl = document.getElementById('status')
const leadEl = document.getElementById('lead')
const actionsEl = document.getElementById('actions')
const signInEl = document.getElementById('signIn')

let currentLead = null

function setStatus(html, className = 'muted') {
  statusEl.innerHTML = html
  statusEl.className = `card ${className}`
}

function excludeEmailsForUser(boot) {
  return [boot?.user?.email, boot?.integrations?.workGmailEmail]
    .map((e) => String(e || '').trim().toLowerCase())
    .filter((e) => e.includes('@'))
}

async function loadGmailContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !String(tab.url || '').includes('mail.google.com')) {
    return { emails: [], subject: '', recipientNames: [] }
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/gmailParticipants.js'],
      func: () => globalThis.__connectIntelExtractGmail?.() || { emails: [], subject: '', recipientNames: [] },
    })
    return result || { emails: [], subject: '', recipientNames: [] }
  } catch {
    return { emails: [], subject: '', recipientNames: [] }
  }
}

function renderLead(match) {
  currentLead = match
  leadEl.hidden = false
  leadEl.innerHTML = `
    <div class="lead">${match.name}</div>
    <div class="muted">${match.company || ''} · ${match.email}</div>
    <div class="muted">Status: ${match.status || '—'}</div>
  `
  actionsEl.hidden = false
}

async function init() {
  try {
    const boot = await extensionBootstrap()
    setStatus(
      `Signed in as <strong>${boot.user.name || boot.user.email}</strong><br/>` +
        (boot.integrations.workGmailConnected
          ? 'Work Gmail connected — trail sync available'
          : 'Connect work Gmail in the app for trail sync'),
      'ok'
    )
    signInEl.hidden = true

    const context = await loadGmailContext()
    const excludeEmails = excludeEmailsForUser(boot)
    const hasSignals =
      (context.emails?.length || 0) > 0 ||
      String(context.subject || '').trim().length >= 2 ||
      (context.recipientNames?.length || 0) > 0

    if (!hasSignals) {
      setStatus(
        (statusEl.innerHTML || '') +
          '<br/><span class="muted">Open a Gmail thread to match a pipeline lead.</span>',
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
      const searchHint = searchQuery ? `Searched: ${searchQuery}` : ''
      const parts = [
        participantHint ? `Participants: ${participantHint}` : '',
        searchHint,
        context.subject ? `Subject: ${context.subject}` : '',
      ].filter(Boolean)
      setStatus(
        `No pipeline lead matched this thread.<br/><span class="muted">${parts.join(' · ')}</span>`,
        'muted'
      )
      return
    }

    renderLead(matches[0])
    if (matches.length > 1) {
      setStatus(`Matched ${matches.length} leads — showing top match`, 'ok')
    } else if (matchedBy === 'search') {
      setStatus(`Matched via subject/name search${searchQuery ? `: ${searchQuery}` : ''}`, 'ok')
    }
  } catch (err) {
    if (err.message === 'not_signed_in') {
      setStatus('Sign in to link Gmail to your CRM pipeline.', 'muted')
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

document.getElementById('syncTrail').addEventListener('click', async () => {
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
})

init()
