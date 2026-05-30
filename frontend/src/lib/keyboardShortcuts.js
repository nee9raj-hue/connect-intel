/** Shared keyboard helpers — never block native browser edit shortcuts. */

const NATIVE_EDIT_KEYS = new Set(['a', 'c', 'v', 'x', 'z', 'y'])

const NON_EDITABLE_INPUT_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'file',
  'image',
  'range',
  'color',
  'hidden',
])

export function isModKey(event) {
  return Boolean(event?.ctrlKey || event?.metaKey)
}

export function isEditableTarget(target) {
  if (!target || typeof target.closest !== 'function') return false
  const el = target.closest('[contenteditable="true"], textarea, select, input')
  if (!el) return false
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase()
    if (NON_EDITABLE_INPUT_TYPES.has(type)) return false
    if (el.readOnly || el.disabled) return false
    return true
  }
  if (el instanceof HTMLTextAreaElement) {
    return !el.readOnly && !el.disabled
  }
  if (el instanceof HTMLSelectElement) {
    return !el.disabled
  }
  if (el.isContentEditable) {
    return el.getAttribute('contenteditable') !== 'false'
  }
  return false
}

export function isNativeEditingShortcut(event) {
  if (!isModKey(event)) return false
  return NATIVE_EDIT_KEYS.has(String(event.key || '').toLowerCase())
}

/** Browser should handle copy/paste/select/undo — do not intercept. */
export function shouldAllowBrowserShortcut(event) {
  if (isEditableTarget(event.target)) return true
  if (isNativeEditingShortcut(event)) return true
  if (isModKey(event) && String(event.key || '').toLowerCase() === 'f') return true
  return false
}

export function hasActiveTextSelection() {
  try {
    const sel = window.getSelection?.()
    return Boolean(sel && !sel.isCollapsed && sel.toString().trim())
  } catch {
    return false
  }
}
