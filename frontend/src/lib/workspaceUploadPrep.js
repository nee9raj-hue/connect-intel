/** Client-side prep for workspace uploads (keep in sync with lib/workspaceUploadPrep.js). */

export const WORKSPACE_UPLOAD_CHUNK_ROWS = 400
export const WORKSPACE_UPLOAD_MAX_ROWS = 5000
const MAX_COLUMNS = 32
const MAX_CELL_LEN = 200

const COLUMN_SCORE = [
  { re: /revenue|amount|sales|turnover|gmv|value|inr|rs|total/, score: 20 },
  { re: /date|shipment|trade|invoice|last_/, score: 18 },
  { re: /customer|company|client|account|buyer|business/, score: 17 },
  { re: /leader|sales|kam|rm|owner|rep|manager|executive/, score: 16 },
  { re: /qty|quantity|weight|cbm|container|awb|bl/, score: 8 },
]

function scoreColumnKey(key) {
  const k = String(key || '').toLowerCase()
  let score = 1
  for (const { re, score: s } of COLUMN_SCORE) {
    if (re.test(k)) score = Math.max(score, s)
  }
  return score
}

export function pickWorkspaceColumns(rows) {
  const keys = new Set()
  for (const row of (rows || []).slice(0, 100)) {
    if (!row || typeof row !== 'object') continue
    for (const key of Object.keys(row)) keys.add(key)
  }
  return [...keys]
    .map((k) => ({ k, score: scoreColumnKey(k) }))
    .sort((a, b) => b.score - a.score || a.k.localeCompare(b.k))
    .slice(0, MAX_COLUMNS)
    .map((x) => x.k)
}

export function slimWorkspaceRow(row, columns) {
  if (!row || typeof row !== 'object') return {}
  const out = {}
  for (const key of columns) {
    const raw = row[key]
    if (raw == null || raw === '') continue
    out[key] = String(raw).slice(0, MAX_CELL_LEN)
  }
  return out
}

export function prepareWorkspaceUploadRows(rowsIn) {
  const list = Array.isArray(rowsIn) ? rowsIn : []
  const total = list.length
  const capped = list.length > WORKSPACE_UPLOAD_MAX_ROWS ? list.slice(0, WORKSPACE_UPLOAD_MAX_ROWS) : list
  const columns = pickWorkspaceColumns(capped)
  const rows = capped.map((row) => slimWorkspaceRow(row, columns))
  return {
    rows,
    columns,
    total,
    truncated: total > WORKSPACE_UPLOAD_MAX_ROWS,
  }
}
