import { getScopedLeadsQuery, scopedLeadsListUrl } from './pipelineScopedQuery.js'
import { pipelineLeadsTableActive } from './pipelineLeadsTable.js'
import { supabaseRest } from './supabaseClient.js'
import { META_STORE_COLLECTIONS } from './pipelineShard.js'
import { readStore } from './store.js'

const DEFAULT_SEARCH_LIMIT = 500
const MAX_SEARCH_LIMIT = 500

/** Escape user input for PostgREST ilike patterns (* wildcards). */
export function escapePostgrestIlike(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

const SEARCH_JSON_FIELDS = [
  'entry->lead->>company',
  'entry->lead->>companyName',
  'entry->lead->>name',
  'entry->lead->>firstName',
  'entry->lead->>lastName',
  'entry->lead->>email',
  'entry->lead->>phone',
]

const SEARCH_SCALAR_FIELDS = ['email', 'phone']

function searchTokens(raw) {
  return String(raw || '')
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function ilikeGroup(term) {
  const pattern = `*${escapePostgrestIlike(term)}*`
  const encoded = encodeURIComponent(pattern)
  const clauses = []
  for (const field of SEARCH_SCALAR_FIELDS) clauses.push(`${field}.ilike.${encoded}`)
  for (const field of SEARCH_JSON_FIELDS) clauses.push(`${field}.ilike.${encoded}`)
  const digits = String(term).replace(/\D/g, '')
  if (digits.length >= 4) {
    const phonePattern = encodeURIComponent(`*${digits}*`)
    clauses.push(`phone.ilike.${phonePattern}`)
    clauses.push(`entry->lead->>phone.ilike.${phonePattern}`)
  }
  return `or(${clauses.join(',')})`
}

/**
 * PostgREST `or=(...)` clause for pipeline text search (role scope applied separately).
 * Comma-separated queries match ANY term (same as pipelineEntryMatchesSearch).
 */
export function buildPipelineSearchPostgrestOr(rawQ) {
  const raw = String(rawQ || '').trim()
  if (raw.length < 2) return null

  // Comma-separated names match ANY name. A multi-word name must match EVERY word
  // (company "VIRATRA IMPEX" still hits; a space inside one ilike pattern does not).
  if (raw.includes(',')) {
    const terms = raw.split(',').map((t) => t.trim()).filter((t) => t.length >= 2)
    if (!terms.length) return null
    return `or=(${terms.map((term) => ilikeGroup(term)).join(',')})`
  }

  const tokens = searchTokens(raw)
  if (!tokens.length) return null
  if (tokens.length === 1) {
    const grouped = ilikeGroup(tokens[0])
    return `or=(${grouped.slice(3, -1)})`
  }
  return `and=(${tokens.map((token) => ilikeGroup(token)).join(',')})`
}

/**
 * Role-scoped pipeline lead IDs from pipeline_leads (indexed columns + JSON ilike).
 * Returns null when the table path is unavailable; [] when no matches.
 */
export async function searchPipelineLeadIdsViaTable(
  user,
  metaStore,
  filters = {},
  { limit = DEFAULT_SEARCH_LIMIT } = {}
) {
  if (!pipelineLeadsTableActive()) return null

  const q = String(filters.q || '').trim()
  if (q.length < 2) return null

  const searchOr = buildPipelineSearchPostgrestOr(q)
  if (!searchOr) return null

  const lim = Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.floor(Number(limit) || DEFAULT_SEARCH_LIMIT)))
  const scopedFilters = { ...filters, q, limit: lim, offset: 0, cursor: null }

  const runClause = async (clause) => {
    if (!clause) return null
    try {
      const scoped = await getScopedLeadsQuery(user, scopedFilters, metaStore)
      scoped.postgrestParts.push(clause)
      scoped.pagination = { ...scoped.pagination, offset: 0, cursor: null }
      scoped.queryString = scoped.postgrestParts.join('&')
      const url = scopedLeadsListUrl(scoped, {
        select: 'lead_id,updated_at',
        order: 'updated_at.desc,lead_id.desc',
      })
      const rows = await supabaseRest(url, {}, { timeoutMs: 12_000, attempts: 1, bypassCircuit: true })
      if (!Array.isArray(rows)) return null
      const seen = new Set()
      const ids = []
      for (const row of rows) {
        const id = row?.lead_id ? String(row.lead_id) : ''
        if (!id || seen.has(id)) continue
        seen.add(id)
        ids.push(id)
        if (ids.length >= lim) break
      }
      return ids
    } catch (err) {
      console.warn('pipeline table search failed:', err?.message || err)
      return null
    }
  }

  try {
    let ids = await runClause(searchOr)
    if (ids === null) ids = await runClause(searchOr)
    const tokens = searchTokens(q)
    if (ids && ids.length === 0 && tokens.length > 1 && !q.includes(',')) {
      const longest = [...tokens].sort((a, b) => b.length - a.length)[0]
      const grouped = ilikeGroup(longest)
      const fallback = await runClause(`or=(${grouped.slice(3, -1)})`)
      if (fallback === null) return null
      if (fallback.length) return fallback
    }
    return ids
  } catch (err) {
    console.warn('pipeline table search failed:', err?.message || err)
    return null
  }
}

/** Convenience wrapper — loads meta store when omitted. */
export async function searchPipelineLeadIds(user, filters = {}, options = {}) {
  const metaStore = options.metaStore || (await readStore({ only: META_STORE_COLLECTIONS }))
  return searchPipelineLeadIdsViaTable(user, metaStore, filters, options)
}
