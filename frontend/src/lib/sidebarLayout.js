export const SIDEBAR_COLLAPSED_KEY = 'ci_sidebar_collapsed'
export const SIDEBAR_MODE_KEY = 'ci_sidebar_mode'

/** @typedef {'expanded' | 'rail'} SidebarMode */

/** @returns {SidebarMode} */
export function loadSidebarMode() {
  try {
    const mode = localStorage.getItem(SIDEBAR_MODE_KEY)
    if (mode === 'expanded' || mode === 'rail') return mode
    if (mode === 'hidden') return 'rail'
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1' ? 'rail' : 'expanded'
  } catch {
    return 'expanded'
  }
}

/** @param {SidebarMode} mode */
export function saveSidebarMode(mode) {
  try {
    localStorage.setItem(SIDEBAR_MODE_KEY, mode)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, mode === 'rail' ? '1' : '0')
  } catch {
    // ignore
  }
}

/** @param {SidebarMode} mode @returns {SidebarMode} */
export function cycleSidebarMode(mode) {
  return mode === 'expanded' ? 'rail' : 'expanded'
}

/** @deprecated use loadSidebarMode */
export function loadSidebarCollapsed() {
  return loadSidebarMode() === 'rail'
}

/** @deprecated use saveSidebarMode */
export function saveSidebarCollapsed(value) {
  saveSidebarMode(value ? 'rail' : 'expanded')
}
