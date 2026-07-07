/**
 * Safe chrome.runtime messaging — stops cleanly after extension reload.
 */
let contextInvalid = false
const teardownCallbacks = new Set()

function isContextInvalidatedError(message) {
  const msg = String(message || '')
  return (
    msg.includes('Extension context invalidated') ||
    msg.includes('Receiving end does not exist') ||
    msg.includes('Could not establish connection') ||
    msg.includes('message port closed') ||
    msg.includes('Message port closed')
  )
}

function isExtensionContextAlive() {
  if (contextInvalid) return false
  try {
    return Boolean(chrome?.runtime?.id)
  } catch {
    return false
  }
}

function invalidateExtensionContext() {
  if (contextInvalid) return
  contextInvalid = true
  for (const cb of teardownCallbacks) {
    try {
      cb()
    } catch {
      /* ignore teardown errors */
    }
  }
  teardownCallbacks.clear()
}

function onExtensionContextInvalidated(callback) {
  if (contextInvalid) return
  teardownCallbacks.add(callback)
}

function safeSendMessage(message, callback) {
  if (!isExtensionContextAlive()) {
    invalidateExtensionContext()
    callback?.(null, new Error('extension_context_invalidated'))
    return
  }

  const onResponse = (response) => {
    const err = chrome.runtime.lastError
    if (err) {
      if (isContextInvalidatedError(err.message)) invalidateExtensionContext()
      callback?.(null, err)
      return
    }
    callback?.(response, null)
  }

  try {
    chrome.runtime.sendMessage(message, onResponse)
  } catch (err) {
    invalidateExtensionContext()
    callback?.(null, err)
  }
}

function safeSendMessageAsync(message) {
  return new Promise((resolve, reject) => {
    safeSendMessage(message, (response, err) => {
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err.message || err)))
        return
      }
      resolve(response)
    })
  })
}

function installGlobalErrorGuards() {
  if (globalThis.__connectIntelRuntimeGuards) return
  globalThis.__connectIntelRuntimeGuards = true

  window.addEventListener('unhandledrejection', (event) => {
    const message = event?.reason?.message || String(event?.reason || '')
    if (isContextInvalidatedError(message)) {
      event.preventDefault()
      invalidateExtensionContext()
    }
  })

  window.addEventListener('error', (event) => {
    if (isContextInvalidatedError(event?.message || event?.error?.message)) {
      event.preventDefault()
      invalidateExtensionContext()
    }
  })
}

if (typeof globalThis !== 'undefined') {
  installGlobalErrorGuards()
  globalThis.__connectIntelRuntime = {
    isExtensionContextAlive,
    invalidateExtensionContext,
    onExtensionContextInvalidated,
    safeSendMessage,
    safeSendMessageAsync,
    isContextInvalidatedError,
  }
}
