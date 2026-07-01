import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildPipelineDealRow } from './pipelineDealsTable.js'

describe('buildPipelineDealRow', () => {
  it('maps deal fields for SQL upsert', () => {
    const row = buildPipelineDealRow(
      'org-1',
      {
        lead: { id: 'lead-1', firstName: 'Ada', lastName: 'Lovelace', company: 'Analytical' },
        assignedToUserId: 'user-9',
        crm: {},
      },
      {
        id: 'deal-1',
        name: 'Enterprise',
        stage: 'replied',
        amount: 120000,
        currency: 'INR',
        createdAt: '2026-06-01T00:00:00.000Z',
      }
    )

    assert.equal(row.organization_id, 'org-1')
    assert.equal(row.lead_id, 'lead-1')
    assert.equal(row.deal_id, 'deal-1')
    assert.equal(row.stage, 'replied')
    assert.equal(row.amount, 120000)
    assert.equal(row.owner_id, 'user-9')
    assert.equal(row.payload.leadName, 'Ada Lovelace')
    assert.equal(row.payload.deal.name, 'Enterprise')
  })
})
