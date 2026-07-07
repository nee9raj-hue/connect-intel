/**
 * Gmail registers document-level keyboard shortcuts in capture phase (e.g. "u" → back to list).
 * Block those while the user types in Connect Intel compose fields.
 */
const WIDGET_HOST_ID = 'connect-intel-widget-host'

function eventInsideWidget(event) {
  const host = document.getElementById(WIDGET_HOST_ID)
  if (!host) return false
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  return path.includes(host)
}

function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function blockGmailShortcuts(event) {
  if (!eventInsideWidget(event)) return
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  if (!isEditableTarget(path[0])) return
  event.stopPropagation()
  event.stopImmediatePropagation()
}

function installGmailKeyboardIsolation() {
  if (globalThis.__connectIntelGmailKeyboardIsolation) return
  globalThis.__connectIntelGmailKeyboardIsolation = true

  for (const type of ['keydown', 'keyup', 'keypress']) {
    document.addEventListener(type, blockGmailShortcuts, true)
    window.addEventListener(type, blockGmailShortcuts, true)
  }
}

installGmailKeyboardIsolation()
