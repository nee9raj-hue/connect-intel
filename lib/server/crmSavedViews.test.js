import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BUILTIN_PIPELINE_VIEWS,
  deletePipelineView,
  listSavedViews,
  savePipelineView,
} from './crmSavedViews.js'

const admin = {
  id: 'admin-1',
  organizationId: 'org-1',
  isOrgAdmin: true,
}

const rep = {
  id: 'rep-1',
  organizationId: 'org-1',
  isOrgAdmin: false,
}

function emptyStore() {
  return { pipelineSavedViews: [] }
}

describe('crmSavedViews org scope', () => {
  it('lists org-shared views for all members in the org', () => {
    const store = {
      pipelineSavedViews: [
        {
          id: 'pview_org',
          userId: admin.id,
          organizationId: 'org-1',
          scope: 'org',
          name: 'Team hot leads',
          filters: { minLeadScore: 80 },
        },
        {
          id: 'pview_personal',
          userId: admin.id,
          organizationId: 'org-1',
          scope: 'personal',
          name: 'My view',
          filters: { city: 'Mumbai' },
        },
      ],
    }

    const views = listSavedViews(store, rep)
    const custom = views.filter((v) => !v.builtin)
    assert.equal(custom.length, 1)
    assert.ok(custom.some((v) => v.id === 'pview_org' && v.scope === 'org'))
  })

  it('saves org view when admin requests org scope', () => {
    const store = emptyStore()
    const view = savePipelineView(store, admin, {
      name: 'Enterprise',
      scope: 'org',
      filters: { status: 'hot' },
    })
    assert.equal(view.scope, 'org')
    assert.equal(store.pipelineSavedViews.length, 1)
  })

  it('rejects org scope for non-admin', () => {
    const store = emptyStore()
    assert.throws(
      () => savePipelineView(store, rep, { name: 'Nope', scope: 'org', filters: {} }),
      /Only company admins can create org-shared views/
    )
  })

  it('allows rep to delete own personal view only', () => {
    const store = {
      pipelineSavedViews: [
        {
          id: 'mine',
          userId: rep.id,
          organizationId: 'org-1',
          scope: 'personal',
          name: 'Mine',
          filters: {},
        },
        {
          id: 'org',
          userId: admin.id,
          organizationId: 'org-1',
          scope: 'org',
          name: 'Org',
          filters: {},
        },
      ],
    }
    deletePipelineView(store, rep, 'mine')
    assert.equal(store.pipelineSavedViews.length, 1)
    assert.throws(() => deletePipelineView(store, rep, 'org'), /View not found/)
  })

  it('allows admin to delete org view', () => {
    const store = {
      pipelineSavedViews: [
        {
          id: 'org',
          userId: admin.id,
          organizationId: 'org-1',
          scope: 'org',
          name: 'Org',
          filters: {},
        },
      ],
    }
    deletePipelineView(store, admin, 'org')
    assert.equal(store.pipelineSavedViews.length, 0)
  })

  it('keeps builtin views', () => {
    const views = listSavedViews(emptyStore(), rep)
    assert.equal(views.filter((v) => v.builtin).length, BUILTIN_PIPELINE_VIEWS.length)
  })
})
