/**
 * Gmail content script — notifies background when thread changes.
 * Constitution: does not read or upload full inbox; header text only for lead match.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

function visibleParticipantEmails() {
  const main = document.querySelector('[role="main"]')
  if (!main) return []
  const text = main.innerText?.slice(0, 6000) || ''
  const set = new Set()
  for (const m of text.matchAll(EMAIL_RE)) {
    set.add(m[0].toLowerCase())
  }
  return [...set].slice(0, 12)
}

let lastKey = ''

function tick() {
  const emails = visibleParticipantEmails()
  const key = emails.sort().join('|')
  if (!key || key === lastKey) return
  lastKey = key
  chrome.runtime.sendMessage({ type: 'GMAIL_PARTICIPANTS', emails }, () => {
    void chrome.runtime.lastError
  })
}

const observer = new MutationObserver(() => tick())
observer.observe(document.documentElement, { childList: true, subtree: true })
setInterval(tick, 4000)
tick()
