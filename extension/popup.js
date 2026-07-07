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

async function loadGmailContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !String(tab.url || '').includes('mail.google.com')) {
    return { emails: [] }
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const emails = new Set()
        const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
        const header = document.querySelector('[role="main"]') || document.body
        const text = header.innerText?.slice(0, 8000) || ''
        for (const match of text.matchAll(re)) emails.add(match[0].toLowerCase())
        return { emails: [...emails].slice(0, 12) }
      },
    })
    return result || { emails: [] }
  } catch {
    return { emails: [] }
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

    const { emails } = await loadGmailContext()
    if (!emails.length) {
      setStatus(
        (statusEl.innerHTML || '') +
          '<br/><span class="muted">Open a Gmail thread to match a pipeline lead.</span>',
        'ok'
      )
      return
    }

    const { matches } = await matchLeadsByEmails(emails)
    if (!matches?.length) {
      setStatus(
        `No pipeline lead matched this thread.<br/><span class="muted">Participants: ${emails.slice(0, 3).join(', ')}</span>`,
        'muted'
      )
      return
    }

    renderLead(matches[0])
    if (matches.length > 1) {
      setStatus(`Matched ${matches.length} leads — showing top match`, 'ok')
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
