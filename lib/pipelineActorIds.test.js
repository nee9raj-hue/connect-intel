import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { listPipelineActorIds } from './pipelineActorIds.js'
import {
  pipelineEntryMatchesAssignee,
  pipelineManagerVisibilityPostgrestFilter,
  pipelineMemberBookPostgrestFilter,
  pipelineRepVisibilityPostgrestFilter,
} from './server/pipelineQuery.js'
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

  it('includes Navya Sagar login plus a Navya first-name stub', () => {
    const navyaStore = {
      users: [
        { id: 'login-navya', email: 'navya@xindus.net', name: 'Navya Sagar' },
        { id: 'stub-navya', name: 'Navya', source: 'erp-owner' },
        { id: 'priya', email: 'priya@xindus.net', name: 'Priya' },
      ],
      organizationMemberships: [
        { userId: 'login-navya', organizationId: 'org1', status: 'active' },
        { userId: 'stub-navya', organizationId: 'org1', status: 'active' },
        { userId: 'priya', organizationId: 'org1', status: 'active' },
      ],
    }
    const ids = listPipelineActorIds(navyaStore, 'org1', {
      id: 'login-navya',
      email: 'navya@xindus.net',
      name: 'Navya Sagar',
    })
    assert.ok(ids.includes('login-navya'))
    assert.ok(ids.includes('stub-navya'))
    assert.equal(ids.includes('priya'), false)
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

  it('admin owner SQL includes ERP sales-owner name for Navya', () => {
    const filter = pipelineMemberBookPostgrestFilter(
      ['login-navya', 'stub-navya'],
      { id: 'login-navya', email: 'navya@xindus.net', name: 'Navya Sagar' }
    )
    assert.match(filter, /owner_id\.in\.\(login-navya,stub-navya\)/)
    assert.match(filter, /salesOwner->>name\.ilike\.\*navya%20sagar\*/)
    assert.match(filter, /salesOwner->>email\.eq\.navya%40xindus\.net/)
  })

  it('owner filter includes ERP sales-owner rows even if CRM assignee is the importer', () => {
    const entry = {
      assignedToUserId: 'neeraj',
      savedByUserId: 'neeraj',
      erp: { ownership: { salesOwner: { name: 'Navya Sagar', email: 'navya@xindus.net' } } },
    }
    const member = { id: 'login-navya', name: 'Navya Sagar', email: 'navya@xindus.net' }
    assert.equal(pipelineEntryMatchesAssignee(entry, 'login-navya', ['stub-navya'], member), true)
    assert.equal(pipelineEntryMatchesAssignee(entry, 'login-navya', ['stub-navya'], null), false)
  })

  it('does not fold Vivek Sharma or a generic Vivek stub into Vivek Kumar Singh', () => {
    const vivekStore = {
      users: [
        { id: 'u-vivek', email: 'vivek.kumar@xindus.net', name: 'Vivek Kumar Singh' },
        { id: 'u-other', email: 'vivek.sharma@xindus.net', name: 'Vivek Sharma' },
        { id: 'stub-vivek', name: 'Vivek', source: 'erp-owner' },
      ],
      organizationMemberships: [
        { userId: 'u-vivek', organizationId: 'org1', status: 'active' },
        { userId: 'u-other', organizationId: 'org1', status: 'active' },
        { userId: 'stub-vivek', organizationId: 'org1', status: 'active' },
      ],
    }
    const ids = listPipelineActorIds(vivekStore, 'org1', {
      id: 'u-vivek',
      email: 'vivek.kumar@xindus.net',
      name: 'Vivek Kumar Singh',
    })
    assert.ok(ids.includes('u-vivek'))
    assert.equal(ids.includes('u-other'), false)
    assert.equal(ids.includes('stub-vivek'), false)
  })
})
