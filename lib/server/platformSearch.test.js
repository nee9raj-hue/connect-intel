import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { searchPlatform } from './platformSearch.js'

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

function baseStore() {
  return {
    savedLeads: [],
    contacts: [],
    companies: [],
    marketingCampaigns: [],
    marketingTemplates: [],
    teamTasks: [],
    teamNotes: [],
    users: [admin, rep],
    organizations: [{ id: 'org-1', name: 'Acme' }],
    organizationMemberships: [],
  }
}

describe('searchPlatform collaboration + templates', () => {
  it('returns visible tasks and notes for org members with chithi navigation', () => {
    const store = baseStore()
    store.teamTasks = [
      {
        id: 'task-1',
        organizationId: 'org-1',
        title: 'Follow up Acme',
        description: 'Call procurement',
        status: 'open',
        authorUserId: admin.id,
        assigneeUserId: rep.id,
      },
      {
        id: 'task-2',
        organizationId: 'org-1',
        title: 'Private admin task',
        description: 'secret',
        status: 'open',
        authorUserId: admin.id,
        assigneeUserId: admin.id,
      },
    ]
    store.teamNotes = [
      {
        id: 'note-1',
        organizationId: 'org-1',
        title: 'Acme pricing note',
        body: 'Discount approved',
        authorUserId: admin.id,
        recipientUserId: rep.id,
      },
    ]

    const repResults = searchPlatform(store, rep, { q: 'acme' })
    assert.ok(repResults.results.some((r) => r.type === 'task' && r.id === 'task-1'))
    assert.ok(repResults.results.some((r) => r.type === 'note' && r.id === 'note-1'))
    assert.equal(repResults.results.find((r) => r.type === 'task')?.panel, 'chithi')
    assert.equal(repResults.results.find((r) => r.type === 'task')?.tab, 'tasks')
    assert.ok(!repResults.results.some((r) => r.id === 'task-2'))
  })

  it('includes marketing templates in fallback search', () => {
    const store = baseStore()
    store.marketingTemplates = [
      {
        id: 'mtpl-1',
        organizationId: 'org-1',
        name: 'Acme intro',
        subject: 'Quick hello from Connect Intel',
        createdByUserId: admin.id,
      },
    ]

    const { results } = searchPlatform(store, admin, { q: 'intro' })
    const template = results.find((r) => r.type === 'template')
    assert.ok(template)
    assert.equal(template.id, 'mtpl-1')
    assert.equal(template.panel, 'marketing')
    assert.equal(template.tab, 'templates')
  })

  it('requires at least two characters', () => {
    const store = baseStore()
    store.teamTasks = [
      {
        id: 'task-1',
        organizationId: 'org-1',
        title: 'Acme',
        authorUserId: admin.id,
        assigneeUserId: admin.id,
      },
    ]
    const short = searchPlatform(store, admin, { q: 'a' })
    assert.equal(short.results.length, 0)
  })
})
