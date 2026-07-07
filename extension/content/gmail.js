/**
 * Gmail content script — notifies background when thread participants change.
 * Constitution: header/metadata only for lead match; no bulk inbox upload.
 */

let lastKey = ''

function tick() {
  const extract = globalThis.__connectIntelExtractGmail
  if (typeof extract !== 'function') return

  const context = extract()
  const key = [
    context.threadId || location.hash || '',
    context.subject || '',
    ...(context.emails || []).sort(),
    ...(context.recipientNames || []).sort(),
  ].join('|')
  if (!key || key === lastKey) return
  lastKey = key

  chrome.runtime.sendMessage({ type: 'GMAIL_PARTICIPANTS', ...context }, () => {
    void chrome.runtime.lastError
  })
}

window.addEventListener('hashchange', () => {
  lastKey = ''
  tick()
})
const observer = new MutationObserver(() => tick())
observer.observe(document.documentElement, { childList: true, subtree: true })
setInterval(tick, 4000)
tick()
