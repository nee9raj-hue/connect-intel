/**
 * Gmail content script — notifies background when thread participants change.
 * Constitution: header/metadata only for lead match; no bulk inbox upload.
 */

const runtime = () => globalThis.__connectIntelRuntime

let lastKey = ''
let observer = null
let pollTimer = null

function teardown() {
  observer?.disconnect()
  observer = null
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

runtime()?.onExtensionContextInvalidated(teardown)

function tick() {
  if (!runtime()?.isExtensionContextAlive()) return

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

  runtime()?.safeSendMessage({ type: 'GMAIL_PARTICIPANTS', ...context })
}

function start() {
  window.addEventListener('hashchange', () => {
    lastKey = ''
    tick()
  })

  observer = new MutationObserver(() => tick())
  observer.observe(document.documentElement, { childList: true, subtree: true })
  pollTimer = setInterval(tick, 4000)
  tick()
}

start()
