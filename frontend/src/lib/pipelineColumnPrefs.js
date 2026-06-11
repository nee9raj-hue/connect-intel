const STORAGE_KEY = 'ci:pipeline-table-columns'
const HOVER_ACTIONS_KEY = 'ci:pipeline-hover-actions'

export const PIPELINE_TABLE_COLUMNS = [
  { id: 'name', label: 'Name', default: true, locked: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'company', label: 'Company', default: true },
  { id: 'city', label: 'City', default: false },
  { id: 'state', label: 'State', default: false },
  { id: 'tags', label: 'Tags', default: false },
  { id: 'phone', label: 'Phone', default: true },
  { id: 'owner', label: 'Lead owner', default: true },
  { id: 'activity', label: 'Last activity', default: true },
  { id: 'email', label: 'Email', default: false },
  { id: 'notes', label: 'Notes', default: false },
  { id: 'created', label: 'Create date', default: false },
]

export const DEFAULT_PIPELINE_VISIBLE_COLUMNS = PIPELINE_TABLE_COLUMNS.filter((c) => c.default).map(
  (c) => c.id,
)

/** Previous default before city/state/tags became optional. */
const LEGACY_DEFAULT_VISIBLE = [
  'name',
  'status',
  'company',
  'city',
  'state',
  'tags',
  'phone',
  'owner',
  'activity',
]

const DEFAULT_VISIBLE = DEFAULT_PIPELINE_VISIBLE_COLUMNS

function isLegacyDefaultPrefs(columnIds) {
  const normalized = normalizePipelineColumnOrder(columnIds)
  return (
    normalized.length === LEGACY_DEFAULT_VISIBLE.length &&
    LEGACY_DEFAULT_VISIBLE.every((id, index) => normalized[index] === id)
  )
}

const VALID_COLUMN_IDS = new Set(PIPELINE_TABLE_COLUMNS.map((c) => c.id))

export function pipelineColumnMeta(id) {
  return PIPELINE_TABLE_COLUMNS.find((c) => c.id === id)
}

/** Visible column ids in display order; name is always first. */
export function normalizePipelineColumnOrder(columnIds) {
  const seen = new Set()
  const ordered = []

  if (columnIds?.includes('name')) {
    ordered.push('name')
    seen.add('name')
  }

  for (const id of columnIds || []) {
    if (id === 'name' || !VALID_COLUMN_IDS.has(id) || seen.has(id)) continue
    ordered.push(id)
    seen.add(id)
  }

  if (!ordered.includes('name')) ordered.unshift('name')
  return ordered.length > 1 || ordered[0] === 'name' ? ordered : [...DEFAULT_VISIBLE]
}

function mergeNewDefaultColumns(columnIds) {
  const cols = normalizePipelineColumnOrder(columnIds)
  const seen = new Set(cols)
  const additions = PIPELINE_TABLE_COLUMNS.filter((c) => c.default && !c.locked && !seen.has(c.id))
  if (!additions.length) return cols

  for (const col of additions) {
    cols.push(col.id)
    seen.add(col.id)
  }
  return normalizePipelineColumnOrder(cols)
}

export function loadPipelineColumnPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_VISIBLE]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_VISIBLE]
    if (isLegacyDefaultPrefs(parsed)) {
      const next = [...DEFAULT_VISIBLE]
      savePipelineColumnPrefs(next)
      return next
    }
    return mergeNewDefaultColumns(parsed)
  } catch {
    return [...DEFAULT_VISIBLE]
  }
}

export function savePipelineColumnPrefs(visibleIds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePipelineColumnOrder(visibleIds)))
  } catch {
    /* ignore */
  }
}

/** Move a visible column up/down; name stays pinned first. */
export function movePipelineColumn(columnIds, id, direction) {
  const cols = normalizePipelineColumnOrder(columnIds)
  if (id === 'name') return cols

  const idx = cols.indexOf(id)
  if (idx < 0) return cols

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 1 || targetIdx >= cols.length) return cols

  const next = [...cols]
  ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
  return next
}

/** Column ids for settings UI: visible (ordered) then hidden (catalog order). */
export function pipelineColumnSettingsRows(visibleIds) {
  const visible = normalizePipelineColumnOrder(visibleIds)
  const visibleSet = new Set(visible)
  const hidden = PIPELINE_TABLE_COLUMNS.map((c) => c.id).filter((id) => !visibleSet.has(id))
  return [...visible, ...hidden]
}

/** Row hover quick actions (Call, Email, Task, etc.) — default off. */
export function loadPipelineHoverActionsPref() {
  try {
    const raw = localStorage.getItem(HOVER_ACTIONS_KEY)
    if (raw === '1' || raw === 'true') return true
    return false
  } catch {
    return false
  }
}

export function savePipelineHoverActionsPref(enabled) {
  try {
    localStorage.setItem(HOVER_ACTIONS_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}
