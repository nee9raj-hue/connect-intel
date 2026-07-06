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

function viewScope(view) {
  return view?.scope === 'org' ? 'org' : 'personal'
}

function sameOrg(view, user) {
  return (view.organizationId || null) === (user.organizationId || null)
}

function canManageOrgViews(user) {
  return Boolean(user?.organizationId && user?.isOrgAdmin)
}

export function listSavedViews(store, user) {
  store.pipelineSavedViews = store.pipelineSavedViews || []
  const custom = store.pipelineSavedViews
    .filter((v) => {
      if (v.builtin) return false
      if (!sameOrg(v, user)) return false
      if (viewScope(v) === 'org') return true
      return v.userId === user.id
    })
    .map((v) => ({
      ...v,
      builtin: false,
      scope: viewScope(v),
      shared: viewScope(v) === 'org',
      canDelete: viewScope(v) === 'org' ? canManageOrgViews(user) : v.userId === user.id,
    }))

  return [...BUILTIN_PIPELINE_VIEWS, ...custom.sort((a, b) => a.name.localeCompare(b.name))]
}

export function savePipelineView(store, user, { name, filters, scope = 'personal' }) {
  const label = String(name || '').trim().slice(0, 80)
  if (!label) throw new Error('View name required')

  const normalizedScope = scope === 'org' ? 'org' : 'personal'
  if (normalizedScope === 'org') {
    if (!user.organizationId) throw new Error('Org-shared views require a company workspace')
    if (!canManageOrgViews(user)) {
      throw new Error('Only company admins can create org-shared views')
    }
  }

  const view = {
    id: createId('pview'),
    userId: user.id,
    organizationId: user.organizationId || null,
    scope: normalizedScope,
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
  const idx = store.pipelineSavedViews.findIndex((v) => v.id === viewId)
  if (idx < 0) throw new Error('View not found')

  const view = store.pipelineSavedViews[idx]
  if (!sameOrg(view, user)) throw new Error('View not found')

  if (viewScope(view) === 'org') {
    if (!canManageOrgViews(user)) throw new Error('View not found')
  } else if (view.userId !== user.id) {
    throw new Error('View not found')
  }

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
