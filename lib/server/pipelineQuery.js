import { CRM_STATUSES } from './crm.js'
import { listPipelineSavedEntries } from './organizations.js'

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
}

export function visiblePipelineEntries(store, user, rawEntries) {
  const scoped = { ...store, savedLeads: rawEntries }
  return listPipelineSavedEntries(scoped, user)
}

export function filterPipelineEntries(entries, { status, q, assigneeUserId, tagIds } = {}) {
  let list = entries

  if (assigneeUserId) {
    list = list.filter(
      (e) => (e.assignedToUserId || e.savedByUserId || e.userId) === assigneeUserId
    )
  }

  if (status && status !== 'all' && CRM_STATUSES.includes(status)) {
    list = list.filter((e) => (e.crm?.status || 'new') === status)
  }

  const tagFilter = (tagIds || []).map(String).filter(Boolean)
  if (tagFilter.length) {
    list = list.filter((e) => {
      const ids = e.crm?.tagIds || []
      return tagFilter.every((id) => ids.includes(id))
    })
  }

  const query = norm(q)
  if (query) {
    list = list.filter((e) => {
      const l = e.lead || {}
      const hay = [
        l.company,
        l.firstName,
        l.lastName,
        l.email,
        l.phone,
        l.city,
        l.state,
        l.title,
        e.crm?.notes,
      ]
        .map(norm)
        .join(' ')
      return hay.includes(query)
    })
  }

  return list
}

export function summarizePipelineEntries(entries) {
  const byStatus = Object.fromEntries(CRM_STATUSES.map((s) => [s, 0]))
  for (const e of entries) {
    const st = e.crm?.status || 'new'
    if (byStatus[st] != null) byStatus[st] += 1
    else byStatus.new += 1
  }
  return {
    total: entries.length,
    byStatus: CRM_STATUSES.map((status) => ({ status, count: byStatus[status] || 0 })),
  }
}

export function boardPipelineSlice(entries, perColumn = 40) {
  const byStatus = Object.fromEntries(CRM_STATUSES.map((s) => [s, []]))
  const sorted = entries
    .slice()
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())

  for (const entry of sorted) {
    const st = entry.crm?.status || 'new'
    const bucket = byStatus[st] || byStatus.new
    if (bucket.length < perColumn) bucket.push(entry)
  }

  return byStatus
}
