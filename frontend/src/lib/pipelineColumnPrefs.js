const STORAGE_KEY = 'ci:pipeline-table-columns'

export const PIPELINE_TABLE_COLUMNS = [
  { id: 'name', label: 'Name', default: true, locked: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'company', label: 'Company', default: true },
  { id: 'phone', label: 'Phone', default: true },
  { id: 'owner', label: 'Lead owner', default: true },
  { id: 'activity', label: 'Last activity', default: true },
  { id: 'tags', label: 'Tags', default: true },
  { id: 'email', label: 'Email', default: false },
  { id: 'notes', label: 'Notes', default: false },
  { id: 'created', label: 'Create date', default: false },
]

const DEFAULT_VISIBLE = PIPELINE_TABLE_COLUMNS.filter((c) => c.default).map((c) => c.id)

export function loadPipelineColumnPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_VISIBLE]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_VISIBLE]
    const valid = new Set(PIPELINE_TABLE_COLUMNS.map((c) => c.id))
    const cols = parsed.filter((id) => valid.has(id))
    if (!cols.includes('name')) cols.unshift('name')
    return cols.length ? cols : [...DEFAULT_VISIBLE]
  } catch {
    return [...DEFAULT_VISIBLE]
  }
}

export function savePipelineColumnPrefs(visibleIds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleIds))
  } catch {
    /* ignore */
  }
}
