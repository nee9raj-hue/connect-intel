/**
 * Gmail thread participant extraction — scoped to the OPEN thread only.
 * Constitution: header/metadata only; no bulk body upload.
 */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

const FOLDER_LABELS =
  /^(inbox|sent mail|sent|drafts|spam|trash|starred|important|all mail|snoozed|scheduled|categories|social|updates|forums|promotions|chats)$/i

const NOISE_EMAIL =
  /(?:^|[.@])(?:noreply|no-reply|mailer-daemon|drive-shares-dm-noreply)|@quoseed\.resend\.app$|sync-contact_/i

const GENERIC_MAIL_DOMAINS =
  /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|protonmail|aol|zoho|yandex|mail)\./i

function addEmail(set, raw) {
  const e = String(raw || '').trim().toLowerCase()
  if (!e.includes('@') || e.length > 320) return
  if (NOISE_EMAIL.test(e)) return
  set.add(e)
}

function isFolderLabel(text) {
  return FOLDER_LABELS.test(String(text || '').trim())
}

/** Reading pane for the currently open thread — not the thread list. */
function findThreadScope() {
  const subjectEl = document.querySelector('h2[data-thread-perm-id]')
  if (subjectEl) {
    let node = subjectEl.parentElement
    for (let depth = 0; depth < 18 && node; depth += 1) {
      if (node.getAttribute('role') === 'main') break
      if (node.querySelector('[data-message-id]')) return node
      node = node.parentElement
    }
  }

  const firstMessage = document.querySelector('[data-message-id]')
  if (firstMessage) {
    let node = firstMessage
    for (let depth = 0; depth < 22 && node; depth += 1) {
      if (node.getAttribute('role') === 'main') break
      const messageCount = node.querySelectorAll('[data-message-id]').length
      if (messageCount >= 1 && node !== document.querySelector('[role="main"]')) return node
      node = node.parentElement
    }
  }

  return null
}

function collectDomEmails(scope, set) {
  scope.querySelectorAll('a[href^="mailto:"]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || ''
    const addr = href.replace(/^mailto:/i, '').split('?')[0]
    try {
      addEmail(set, decodeURIComponent(addr))
    } catch {
      addEmail(set, addr)
    }
  })

  scope.querySelectorAll('[data-hovercard-id]').forEach((el) => {
    const id = el.getAttribute('data-hovercard-id') || ''
    if (id.includes('@')) addEmail(set, id)
  })

  scope.querySelectorAll('[email]').forEach((el) => {
    addEmail(set, el.getAttribute('email'))
  })

  scope.querySelectorAll('[data-email]').forEach((el) => {
    addEmail(set, el.getAttribute('data-email'))
  })
}

function collectAriaParticipantEmails(scope, set) {
  scope.querySelectorAll('[aria-label]').forEach((el) => {
    const label = el.getAttribute('aria-label') || ''
    const headerMatch = label.match(/^(?:from|to|cc|bcc|reply-to)\s+(.+)$/i)
    if (!headerMatch) return
    for (const match of headerMatch[1].matchAll(EMAIL_RE)) addEmail(set, match[0])
  })
}

function extractSubject(scope) {
  const scopedSubject = scope?.querySelector('h2[data-thread-perm-id]')
  if (scopedSubject) {
    const text = scopedSubject.textContent?.trim()?.replace(/^(re|fwd|fw):\s*/gi, '') || ''
    if (text && !isFolderLabel(text)) return text
  }

  const title = document.title || ''
  const fromTitle = title.split(/\s+-\s+/)[0]?.trim()
  if (
    fromTitle &&
    fromTitle.length >= 3 &&
    !isFolderLabel(fromTitle) &&
    !fromTitle.toLowerCase().includes('@')
  ) {
    return fromTitle.replace(/^(re|fwd|fw):\s*/gi, '').trim()
  }

  return ''
}

function extractRecipientNames(scope) {
  const names = new Set()

  scope.querySelectorAll('[aria-label]').forEach((el) => {
    const label = el.getAttribute('aria-label') || ''
    const rowMatch = label.match(/^(?:to|cc|bcc)\s+([^,]+(?:,[^,]+)*)/i)
    if (!rowMatch) return
    rowMatch[1].split(',').forEach((part) => {
      const name = part.replace(EMAIL_RE, '').replace(/<[^>]+>/g, '').trim()
      if (name.length >= 2 && name.length <= 60 && !name.includes('@')) names.add(name)
    })
  })

  const bodyStart = (scope.innerText || '').slice(0, 2000)
  const dearMatch = bodyStart.match(/\bDear\s+([A-Za-z][A-Za-z .'-]{1,40})/i)
  if (dearMatch?.[1]) {
    const dear = dearMatch[1].trim()
    if (dear.length >= 2) names.add(dear.split(/\s+/)[0])
  }

  return [...names].slice(0, 8)
}

function domainHintsFromEmails(emails) {
  const hints = new Set()
  for (const email of emails) {
    const domain = String(email).split('@')[1]?.toLowerCase()
    if (!domain || GENERIC_MAIL_DOMAINS.test(domain)) continue
    const root = domain.split('.')[0]
    if (root.length < 3) continue
    hints.add(root)
    const splitMatch = root.match(
      /^(.+?)(fresh|food|foods|corp|inc|ltd|llc|co|group|global|logistics|shipping|exports|import|trade|tech|labs|studio|works)$/i
    )
    if (splitMatch?.[1]?.length >= 2) {
      hints.add(`${splitMatch[1]} ${splitMatch[2]}`.trim())
    }
  }
  return [...hints].slice(0, 6)
}

function extractGmailThreadParticipants() {
  try {
    const threadId = location.hash || ''
    const scope = findThreadScope()

    if (!scope) {
      return {
        emails: [],
        subject: '',
        recipientNames: [],
        threadId,
        domainHints: [],
      }
    }

    const emails = new Set()
    collectDomEmails(scope, emails)
    collectAriaParticipantEmails(scope, emails)

    const headerRoot =
      scope.querySelector('h2[data-thread-perm-id]')?.closest('div')?.parentElement || scope
    const headerText = (headerRoot.innerText || '').slice(0, 4000)
    for (const match of headerText.matchAll(EMAIL_RE)) addEmail(emails, match[0])

    const firstMessage = scope.querySelector('[data-message-id]')
    if (firstMessage) {
      const messageHeader = firstMessage.parentElement || firstMessage
      const messageText = (messageHeader.innerText || '').slice(0, 2500)
      for (const match of messageText.matchAll(EMAIL_RE)) addEmail(emails, match[0])
    }

    const emailList = [...emails].slice(0, 20)

    return {
      emails: emailList,
      subject: extractSubject(scope),
      recipientNames: extractRecipientNames(scope),
      threadId,
      domainHints: domainHintsFromEmails(emailList),
    }
  } catch {
    return {
      emails: [],
      subject: '',
      recipientNames: [],
      threadId: location.hash || '',
      domainHints: [],
    }
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.__connectIntelExtractGmail = extractGmailThreadParticipants
}
