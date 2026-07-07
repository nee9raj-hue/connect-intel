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
  'entry->lead->>city',
  'entry->lead->>state',
  'entry->lead->>title',
  'entry->lead->>location',
  'entry->lead->>linkedin',
  'entry->crm->>notes',
]

const SEARCH_SCALAR_FIELDS = ['email', 'phone']

/**
 * PostgREST `or=(...)` clause for pipeline text search (role scope applied separately).
 * Comma-separated queries match ANY term (same as pipelineEntryMatchesSearch).
 */
export function buildPipelineSearchPostgrestOr(rawQ) {
  const raw = String(rawQ || '').trim()
  if (raw.length < 2) return null

  const terms = raw.includes(',')
    ? raw.split(',').map((t) => t.trim()).filter((t) => t.length >= 2)
    : [raw]
  if (!terms.length) return null

  const clauses = new Set()

  for (const term of terms) {
    const pattern = `*${escapePostgrestIlike(term)}*`
    const encoded = encodeURIComponent(pattern)
    for (const field of SEARCH_SCALAR_FIELDS) {
      clauses.add(`${field}.ilike.${encoded}`)
    }
    for (const field of SEARCH_JSON_FIELDS) {
      clauses.add(`${field}.ilike.${encoded}`)
    }
    const digits = String(term).replace(/\D/g, '')
    if (digits.length >= 4) {
      clauses.add(`phone.ilike.${encodeURIComponent(`*${digits}*`)}`)
      clauses.add(`entry->lead->>phone.ilike.${encodeURIComponent(`*${digits}*`)}`)
    }
  }

  if (!clauses.size) return null
  return `or=(${[...clauses].join(',')})`
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
  const scoped = await getScopedLeadsQuery(
    user,
    { ...filters, limit: lim, offset: 0 },
    metaStore
  )
  scoped.postgrestParts.push(searchOr)
  scoped.queryString = scoped.postgrestParts.join('&')

  const url = scopedLeadsListUrl(scoped, {
    select: 'lead_id,updated_at',
    order: 'updated_at.desc,lead_id.desc',
  })

  try {
    const rows = await supabaseRest(url, {}, { timeoutMs: 8_000, attempts: 2 })
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

/** Convenience wrapper — loads meta store when omitted. */
export async function searchPipelineLeadIds(user, filters = {}, options = {}) {
  const metaStore = options.metaStore || (await readStore({ only: META_STORE_COLLECTIONS }))
  return searchPipelineLeadIdsViaTable(user, metaStore, filters, options)
}
