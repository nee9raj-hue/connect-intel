import { createId } from './store.js'

export const BUILTIN_PIPELINE_VIEWS = [
  {
    id: 'builtin_stale',
    name: 'No touch 7+ days',
    builtin: true,
    filters: { staleDays: 7 },
  },
  {
    id: 'builtin_hot',
    name: 'Hot (score 70+)',
    builtin: true,
    filters: { minLeadScore: 70 },
  },
  {
    id: 'builtin_high_value',
    name: 'High value (₹1L+)',
    builtin: true,
    filters: { minDealValue: 100000 },
  },
  {
    id: 'builtin_overdue',
    name: 'Overdue follow-up',
    builtin: true,
    filters: { overdueFollowUp: true },
  },
  {
    id: 'builtin_has_email',
    name: 'Has email',
    builtin: true,
    filters: { contact: 'has_email' },
  },
]

export function listSavedViews(store, user) {
  store.pipelineSavedViews = store.pipelineSavedViews || []
  const custom = store.pipelineSavedViews
    .filter(
      (v) =>
        v.userId === user.id &&
        (v.organizationId || null) === (user.organizationId || null)
    )
    .map((v) => ({ ...v, builtin: false }))

  return [...BUILTIN_PIPELINE_VIEWS, ...custom.sort((a, b) => a.name.localeCompare(b.name))]
}

export function savePipelineView(store, user, { name, filters }) {
  const label = String(name || '').trim().slice(0, 80)
  if (!label) throw new Error('View name required')

  const view = {
    id: createId('pview'),
    userId: user.id,
    organizationId: user.organizationId || null,
    name: label,
    filters: sanitizeViewFilters(filters),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  store.pipelineSavedViews = store.pipelineSavedViews || []
  store.pipelineSavedViews.push(view)
  return view
}

export function deletePipelineView(store, user, viewId) {
  store.pipelineSavedViews = store.pipelineSavedViews || []
  const idx = store.pipelineSavedViews.findIndex((v) => v.id === viewId && v.userId === user.id)
  if (idx < 0) throw new Error('View not found')
  store.pipelineSavedViews.splice(idx, 1)
  return { ok: true }
}

function sanitizeViewFilters(filters) {
  const f = filters && typeof filters === 'object' ? filters : {}
  return {
    city: String(f.city || '').slice(0, 80),
    state: String(f.state || '').slice(0, 80),
    contact: String(f.contact || 'any'),
    status: String(f.status || 'all'),
    search: String(f.search || '').slice(0, 120),
    minLeadScore: f.minLeadScore != null ? Number(f.minLeadScore) : null,
    minDealValue: f.minDealValue != null ? Number(f.minDealValue) : null,
    staleDays: f.staleDays != null ? Number(f.staleDays) : null,
    overdueFollowUp: Boolean(f.overdueFollowUp),
  }
}
