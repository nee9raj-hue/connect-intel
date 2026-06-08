/** Client-side prep for platform master-data imports (keep payloads small for serverless). */

export const IMPORT_UPLOAD_CHUNK_ROWS = 40
const MAX_CELL_LEN = 500

export function slimImportRow(row) {
  if (!row || typeof row !== 'object') return {}
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    if (value == null || value === '') continue
    const text = String(value).trim()
    if (!text) continue
    out[key] = text.slice(0, MAX_CELL_LEN)
  }
  return out
}

export function prepareImportUploadRows(rowsIn) {
  const list = Array.isArray(rowsIn) ? rowsIn : []
  const rows = list.map(slimImportRow).filter((row) => Object.keys(row).length > 0)
  return { rows, total: list.length }
}
