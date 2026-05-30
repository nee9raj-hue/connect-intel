export const PANEL_PREF_STORAGE_KEY = 'ci_panel_preferences_v1'

export const PANEL_PREF_STEPS = [-2, -1, 0, 1, 2]

export const PANEL_PREF_STEP_LABELS = {
  '-2': 'XS',
  '-1': 'S',
  0: 'Default',
  1: 'L',
  2: 'XL',
}

/** UI groups — each has independent font + icon scale (iPhone-style). */
export const PANEL_PREF_GROUPS = [
  {
    id: 'sidebar',
    label: 'Left menu',
    description: 'Sidebar navigation labels, section headers, and menu icons.',
  },
  {
    id: 'main',
    label: 'Main workspace',
    description: 'Pipeline, dashboard, tables, lead panel, and form text.',
  },
  {
    id: 'mobileNav',
    label: 'Mobile bottom bar',
    description: 'Quick shortcuts at the bottom of your phone screen.',
  },
  {
    id: 'header',
    label: 'Top bar',
    description: 'Page titles, toolbar chips, and mobile header text.',
  },
]

export const DEFAULT_PANEL_PREFERENCES = Object.freeze(
  PANEL_PREF_GROUPS.reduce((acc, group) => {
    acc[group.id] = { fontStep: 0, iconStep: 0 }
    return acc
  }, {})
)

const FONT_SCALE_BY_STEP = Object.freeze({
  '-2': 0.86,
  '-1': 0.93,
  0: 1,
  1: 1.08,
  2: 1.16,
})

const ICON_SCALE_BY_STEP = Object.freeze({
  '-2': 0.82,
  '-1': 0.9,
  0: 1,
  1: 1.1,
  2: 1.2,
})

function storageKey(userId) {
  return userId ? `${PANEL_PREF_STORAGE_KEY}_${userId}` : PANEL_PREF_STORAGE_KEY
}

function clampStep(step) {
  const n = Number(step)
  if (!Number.isFinite(n)) return 0
  return Math.max(-2, Math.min(2, Math.round(n)))
}

export function stepToFontScale(step) {
  return FONT_SCALE_BY_STEP[String(clampStep(step))] ?? 1
}

export function stepToIconScale(step) {
  return ICON_SCALE_BY_STEP[String(clampStep(step))] ?? 1
}

function normalizeGroup(raw = {}) {
  return {
    fontStep: clampStep(raw.fontStep),
    iconStep: clampStep(raw.iconStep),
  }
}

export function normalizePanelPreferences(raw) {
  const next = {}
  for (const group of PANEL_PREF_GROUPS) {
    next[group.id] = normalizeGroup(raw?.[group.id])
  }
  return next
}

export function isDefaultPanelPreferences(prefs) {
  const normalized = normalizePanelPreferences(prefs)
  return PANEL_PREF_GROUPS.every((group) => {
    const g = normalized[group.id]
    return g.fontStep === 0 && g.iconStep === 0
  })
}

export function loadPanelPreferences(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return normalizePanelPreferences(DEFAULT_PANEL_PREFERENCES)
    return normalizePanelPreferences(JSON.parse(raw))
  } catch {
    return normalizePanelPreferences(DEFAULT_PANEL_PREFERENCES)
  }
}

export function savePanelPreferences(userId, prefs) {
  const normalized = normalizePanelPreferences(prefs)
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(normalized))
  } catch {
    // ignore quota / private mode
  }
  return normalized
}

export function applyPanelPreferences(prefs) {
  if (typeof document === 'undefined') return
  const normalized = normalizePanelPreferences(prefs)
  const root = document.documentElement

  for (const group of PANEL_PREF_GROUPS) {
    const g = normalized[group.id]
    root.style.setProperty(`--ci-pref-${group.id}-font-scale`, String(stepToFontScale(g.fontStep)))
    root.style.setProperty(`--ci-pref-${group.id}-icon-scale`, String(stepToIconScale(g.iconStep)))
  }

  root.dataset.ciPanelCustomized = isDefaultPanelPreferences(normalized) ? '0' : '1'
}

export function resetPanelPreferences(userId) {
  const defaults = normalizePanelPreferences(DEFAULT_PANEL_PREFERENCES)
  savePanelPreferences(userId, defaults)
  applyPanelPreferences(defaults)
  return defaults
}

export function updatePanelPreferenceGroup(userId, prefs, groupId, patch) {
  const normalized = normalizePanelPreferences(prefs)
  if (!normalized[groupId]) return normalized
  normalized[groupId] = normalizeGroup({ ...normalized[groupId], ...patch })
  savePanelPreferences(userId, normalized)
  applyPanelPreferences(normalized)
  return normalized
}
