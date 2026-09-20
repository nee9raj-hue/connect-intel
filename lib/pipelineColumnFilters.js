import { crmStatusMatchesFilter, crmStatusSqlAliases } from './crmLeadStatuses.js'

export const NOTES_PRESENCE_OPTIONS = [
  { value: 'has', label: 'Has notes' },
  { value: 'blank', label: 'Blank' },
]

export function collectStatusFilterIds(filters = {}) {
  return [
    ...new Set(
      (filters.statusIds || [])
        .map((id) => String(id || '').trim().toLowerCase())
        .filter((id) => id && id !== 'all')
    ),
  ]
}

export function statusFilterSqlAliases(ids = []) {
  return [...new Set(ids.flatMap((id) => crmStatusSqlAliases(id)).filter(Boolean))]
}

export function leadMatchesStatusIds(leadOrEntry, ids = []) {
  if (!ids.length) return true
  const status = leadOrEntry?.crm?.status ?? leadOrEntry?.lead?.crm?.status ?? leadOrEntry?.status
  return ids.some((id) => crmStatusMatchesFilter(status, id))
}

export function normalizeNotesPresence(filters = {}) {
  const raw = filters.notesPresence ?? filters.notesFilter
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  const set = new Set(
    list
      .map((value) => String(value || '').trim().toLowerCase())
      .filter((value) => value === 'has' || value === 'blank')
  )
  if (set.size !== 1) return ''
  return [...set][0]
}

export function leadHasCustomerNotes(leadOrEntry) {
  return Boolean(String(leadOrEntry?.crm?.notes ?? leadOrEntry?.lead?.crm?.notes ?? '').trim())
}

export function leadMatchesNotesPresence(leadOrEntry, filters = {}) {
  const mode = normalizeNotesPresence(filters)
  if (!mode) return true
  const has = leadHasCustomerNotes(leadOrEntry)
  return mode === 'has' ? has : !has
}

export function notesPresenceSqlParts(filters = {}) {
  const mode = normalizeNotesPresence(filters)
  if (mode === 'has') {
    return ['not.or=(entry->crm->>notes.is.null,entry->crm->>notes.eq.)']
  }
  if (mode === 'blank') {
    return ['or=(entry->crm->>notes.is.null,entry->crm->>notes.eq.)']
  }
  return []
}
