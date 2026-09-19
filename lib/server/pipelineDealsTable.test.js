import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPipelineDealRow,
  filterMappedDealRowsByStage,
  pipelineDealsStageFilterSql,
} from './pipelineDealsTable.js'

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

  it('stores deal stage in lowercase so Lost matches lost', () => {
    const row = buildPipelineDealRow(
      'org-1',
      { lead: { id: 'lead-1', firstName: 'A', lastName: 'B' } },
      { id: 'deal-2', name: 'Lane', stage: 'Lost' }
    )
    assert.equal(row.stage, 'lost')
  })
})

describe('filterMappedDealRowsByStage', () => {
  const rows = [
    { deal: { id: 'a', stage: 'lost' } },
    { deal: { id: 'b', stage: 'Lost' } },
    { deal: { id: 'c', stage: 'LOST' } },
    { deal: { id: 'd', stage: 'rfq' } },
    { deal: { id: 'e', stage: 'quoted' }, stage: 'lost' },
  ]

  it('lists every lost deal the sidebar would count, not only exact stage=lost', () => {
    const lost = filterMappedDealRowsByStage(rows, { stage: 'lost', freightOrg: true, includeClosed: true })
    assert.deepEqual(
      lost.map((r) => r.deal.id),
      ['a', 'b', 'c', 'e']
    )
  })

  it('counts a deal as lost when either payload or SQL column is lost', () => {
    const mixed = filterMappedDealRowsByStage(
      [{ deal: { id: 'payload-lost', stage: 'lost' }, stage: 'rfq' }],
      { stage: 'lost', freightOrg: true, includeClosed: true }
    )
    assert.equal(mixed.length, 1)
    assert.equal(mixed[0].deal.id, 'payload-lost')
  })
})

describe('pipelineDealsStageFilterSql', () => {
  it('does not filter All Deals so the query stays a small page', () => {
    assert.equal(pipelineDealsStageFilterSql('all'), '')
  })

  it('filters one stage in SQL instead of downloading the org table', () => {
    assert.equal(
      pipelineDealsStageFilterSql('lost', { freightOrg: true }),
      '&or=(stage.eq.lost,payload->deal->>stage.eq.lost)'
    )
  })
})
