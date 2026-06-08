export const TIMELINE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'call', label: 'Calls' },
  { id: 'email', label: 'Emails' },
  { id: 'deal', label: 'Deals' },
  { id: 'task', label: 'Tasks' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'note', label: 'Notes' },
]

export function matchesTimelineFilter(item, filter) {
  if (!filter || filter === 'all') return true
  if (filter === 'deal') return item.kind === 'deal' || String(item.type || '').startsWith('deal_')
  if (filter === 'task') return item.kind === 'task' || String(item.type || '').startsWith('task')
  if (filter === 'meeting') return item.kind === 'meeting' || item.type === 'field_visit'
  return String(item.type || '').toLowerCase() === filter
}

export function countTimelineFilters(timeline = []) {
  const counts = { all: timeline.length }
  for (const f of TIMELINE_FILTERS) {
    if (f.id === 'all') continue
    counts[f.id] = timeline.filter((item) => matchesTimelineFilter(item, f.id)).length
  }
  return counts
}
