/**
 * Gmail thread participant extraction — header/metadata only (no bulk body upload).
 * Loaded in content script and injected via chrome.scripting for the popup.
 */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

function addEmail(set, raw) {
  const e = String(raw || '').trim().toLowerCase()
  if (e.includes('@') && e.length <= 320) set.add(e)
}

function collectDomEmails(set) {
  document.querySelectorAll('a[href^="mailto:"]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || ''
    const addr = href.replace(/^mailto:/i, '').split('?')[0]
    try {
      addEmail(set, decodeURIComponent(addr))
    } catch {
      addEmail(set, addr)
    }
  })

  document.querySelectorAll('[data-hovercard-id]').forEach((el) => {
    const id = el.getAttribute('data-hovercard-id') || ''
    if (id.includes('@')) addEmail(set, id)
  })

  document.querySelectorAll('[email]').forEach((el) => {
    addEmail(set, el.getAttribute('email'))
  })

  document.querySelectorAll('[data-email]').forEach((el) => {
    addEmail(set, el.getAttribute('data-email'))
  })
}

function extractSubject() {
  const title = document.title || ''
  const fromTitle = title.split(/\s+-\s+/)[0]?.trim()
  if (
    fromTitle &&
    fromTitle.length >= 3 &&
    !/^(inbox|gmail|mail)$/i.test(fromTitle) &&
    !fromTitle.toLowerCase().includes('@')
  ) {
    return fromTitle.replace(/^(re|fwd|fw):\s*/gi, '').trim()
  }

  const h2 = document.querySelector('[role="main"] h2, h2[data-thread-perm-id]')
  return h2?.textContent?.trim()?.replace(/^(re|fwd|fw):\s*/gi, '') || ''
}

function extractRecipientNames() {
  const names = new Set()
  const main = document.querySelector('[role="main"]')
  if (!main) return []

  main.querySelectorAll('[aria-label]').forEach((el) => {
    const label = el.getAttribute('aria-label') || ''
    const rowMatch = label.match(/^(?:to|cc|bcc)\s+([^,]+(?:,[^,]+)*)/i)
    if (!rowMatch) return
    rowMatch[1].split(',').forEach((part) => {
      const name = part.replace(EMAIL_RE, '').replace(/<[^>]+>/g, '').trim()
      if (name.length >= 2 && name.length <= 60 && !name.includes('@')) names.add(name)
    })
  })

  const bodyStart = (main.innerText || '').slice(0, 2000)
  const dearMatch = bodyStart.match(/\bDear\s+([A-Za-z][A-Za-z .'-]{1,40})/i)
  if (dearMatch?.[1]) {
    const dear = dearMatch[1].trim()
    if (dear.length >= 2) names.add(dear.split(/\s+/)[0])
  }

  return [...names].slice(0, 8)
}

function extractGmailThreadParticipants() {
  const emails = new Set()
  collectDomEmails(emails)

  const main = document.querySelector('[role="main"]')
  if (main) {
    const headerRoot = main.querySelector('h2')?.closest('div')?.parentElement || main
    const headerText = (headerRoot.innerText || '').slice(0, 5000)
    for (const match of headerText.matchAll(EMAIL_RE)) addEmail(emails, match[0])

    const earlyText = (main.innerText || '').slice(0, 3000)
    for (const match of earlyText.matchAll(EMAIL_RE)) addEmail(emails, match[0])
  }

  return {
    emails: [...emails].slice(0, 20),
    subject: extractSubject(),
    recipientNames: extractRecipientNames(),
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.__connectIntelExtractGmail = extractGmailThreadParticipants
}
