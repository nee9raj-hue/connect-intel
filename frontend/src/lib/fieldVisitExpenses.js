export {
  TRAVEL_MODES,
  DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS,
  mergeFieldVisitExpenseSettings,
  buildLeadDestinationLabel,
  computeTravelClaimAmount,
  normalizeVisitTravelPayload,
  travelModeLabel,
  formatInr,
} from '../../../lib/fieldVisitExpenses.js'

export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(monthKey) {
  const [y, m] = String(monthKey || '').split('-').map(Number)
  if (!y || !m) return monthKey
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function exportFieldVisitsCsv(visits, monthKey) {
  const header = [
    'Date',
    'Lead',
    'Company',
    'Destination',
    'Start',
    'Mode',
    'Distance km',
    'Claim INR',
    'Outcome',
    'Notes',
  ]
  const rows = (visits || []).map((v) => [
    v.visitAt ? new Date(v.visitAt).toISOString().slice(0, 16).replace('T', ' ') : '',
    v.leadName || '',
    v.company || '',
    v.destination || '',
    v.startLocation || v.travel?.startLabel || '',
    v.travel?.modeLabel || v.travel?.mode || '',
    v.travel?.distanceKm ?? '',
    v.claimAmount ?? '',
    v.outcome || '',
    (v.notes || '').replace(/\r?\n/g, ' '),
  ])
  const escape = (cell) => {
    const s = String(cell ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `field-expenses-${monthKey || 'export'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
