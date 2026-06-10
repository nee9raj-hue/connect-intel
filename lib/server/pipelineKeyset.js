/** Keyset (cursor) pagination for pipeline_leads — avoids OFFSET on large orgs. */

export function encodePipelineCursor({ updatedAt, leadId }) {
  if (!updatedAt || !leadId) return null
  const payload = JSON.stringify({
    u: String(updatedAt),
    l: String(leadId),
  })
  return Buffer.from(payload, 'utf8').toString('base64url')
}

export function decodePipelineCursor(cursor) {
  const raw = String(cursor || '').trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (!parsed?.u || !parsed?.l) return null
    return { updatedAt: String(parsed.u), leadId: String(parsed.l) }
  } catch {
    return null
  }
}

/** PostgREST filter: rows strictly before (updated_at, lead_id) in DESC order. */
export function postgrestKeysetFilter(cursor) {
  if (!cursor?.updatedAt || !cursor?.leadId) return null
  const ts = encodeURIComponent(cursor.updatedAt)
  const lid = encodeURIComponent(cursor.leadId)
  return `or=(updated_at.lt.${ts},and(updated_at.eq.${ts},lead_id.lt.${lid}))`
}

export function buildNextPipelineCursor(rows, limit) {
  if (!Array.isArray(rows) || rows.length < limit || limit < 1) return null
  const last = rows[rows.length - 1]
  const updatedAt = last?.updated_at || last?.updatedAt
  const leadId = last?.lead_id || last?.leadId
  return encodePipelineCursor({ updatedAt, leadId })
}
