import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rankDiscoveryCompanies, summarizeRankedCompanies } from './companyRanker.js'

describe('companyRanker', () => {
  it('ranks companies with email and website higher', () => {
    const ranked = rankDiscoveryCompanies([
      { company: 'A Corp', website: 'https://a.com' },
      { company: 'B Corp', email: 'sales@b.com', website: 'https://b.com', contactName: 'Raj' },
    ])
    assert.equal(ranked[0].company, 'B Corp')
    assert.ok(ranked[0].rankScore > ranked[1].rankScore)
    assert.ok(['top', 'good'].includes(ranked[0].tier))
  })

  it('summarizes tier counts', () => {
    const ranked = rankDiscoveryCompanies([
      { company: 'A', email: 'a@b.com', website: 'https://a.com', contactName: 'X' },
      { company: 'B' },
    ])
    const summary = summarizeRankedCompanies(ranked)
    assert.match(summary, /\d+/)
  })
})
