import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { listPipelineActorIds } from './pipelineActorIds.js'
import { pipelineManagerVisibilityPostgrestFilter, pipelineRepVisibilityPostgrestFilter } from './server/pipelineQuery.js'
import { applyPipelineSummaryForUser } from './server/pipelineIndex.js'
import { repPipelineEntryVisible } from './pipelineOwner.js'

describe('pipeline actor aliases', () => {
  const store = {
    users: [
      { id: 'login-tan', email: 'tanishq@xindus.net', name: 'Tanishq Kumar' },
      { id: 'stub-tan', email: 'tanishq@xindus.net', name: 'Tanishq', source: 'erp-owner' },
      { id: 'priya', email: 'priya@xindus.net', name: 'Priya' },
    ],
    organizationMemberships: [
      { userId: 'login-tan', organizationId: 'org1', status: 'active' },
      { userId: 'stub-tan', organizationId: 'org1', status: 'active' },
      { userId: 'priya', organizationId: 'org1', status: 'active' },
    ],
  }

  it('includes same-email and ERP stub ids for Tanishq', () => {
    const ids = listPipelineActorIds(store, 'org1', {
      id: 'login-tan',
      email: 'tanishq@xindus.net',
      name: 'Tanishq Kumar',
    })
    assert.ok(ids.includes('login-tan'))
    assert.ok(ids.includes('stub-tan'))
    assert.equal(ids.includes('priya'), false)
  })

  it('rep SQL matches every identity id', () => {
    const filter = pipelineRepVisibilityPostgrestFilter(['login-tan', 'stub-tan'])
    assert.match(filter, /owner_id\.in\.\(login-tan,stub-tan\)/)
    assert.match(filter, /assignedToUserId\.eq\.stub-tan/)
  })

  it('manager SQL includes own book not only team_id', () => {
    const filter = pipelineManagerVisibilityPostgrestFilter({
      teamId: 'team-longtail',
      ownerIds: ['login-tan', 'stub-tan'],
    })
    assert.match(filter, /team_id\.eq\.team-longtail/)
    assert.match(filter, /owner_id\.in\.\(login-tan,stub-tan\)/)
  })

  it('lets Tanishq see a lead assigned to his ERP stub', () => {
    const entry = { assignedToUserId: 'stub-tan', savedByUserId: 'neeraj' }
    assert.equal(repPipelineEntryVisible(entry, 'login-tan', ['stub-tan']), true)
    assert.equal(repPipelineEntryVisible(entry, 'login-tan'), false)
  })

  it('sums assignee index buckets across identity ids', () => {
    const summary = applyPipelineSummaryForUser(
      {
        byAssignee: {
          'stub-tan': {
            total: 12,
            byStatus: [{ status: 'new_account', count: 12 }],
          },
        },
        cities: [],
        states: [],
      },
      {
        id: 'login-tan',
        email: 'tanishq@xindus.net',
        name: 'Tanishq Kumar',
        organizationId: 'org1',
        accountType: 'company',
      },
      {
        ...store,
        organizations: [{ id: 'org1', accountType: 'company' }],
      }
    )
    assert.equal(summary.total, 12)
  })
})
