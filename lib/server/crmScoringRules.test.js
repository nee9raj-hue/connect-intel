import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeCrmLeadScore,
  DEFAULT_SCORING_RULES,
  getOrgScoringRules,
  normalizeScoringRules,
} from './crmScoringRules.js'

function entry(overrides = {}) {
  return {
    lead: { id: 'lead-1', email: 'jane@acme.example', company: 'Acme', ...overrides.lead },
    crm: { status: 'contacted', ...overrides.crm },
  }
}

const storeWithRules = (rules) => ({
  organizations: [{ id: 'org-1', crmSettings: { scoringRules: rules } }],
})

describe('crmScoringRules', () => {
  it('normalizes custom rule points within bounds', () => {
    const rules = normalizeScoringRules([
      { id: 'x', label: 'Big', event: 'email_open', points: 500, enabled: true },
      { id: 'y', label: 'Small', event: 'unsubscribe', points: -200, enabled: true },
    ])
    assert.equal(rules[0].points, 100)
    assert.equal(rules[1].points, -100)
  })

  it('uses org scoring rules when configured', () => {
    const custom = normalizeScoringRules([
      { id: 'base', label: 'Base', event: 'base', points: 10, enabled: true },
      { id: 'open', label: 'Open', event: 'email_open', points: 40, enabled: true },
    ])
    const score = computeCrmLeadScore(entry(), {
      store: storeWithRules(custom),
      organizationId: 'org-1',
      marketingEvents: [{ leadId: 'lead-1', type: 'open' }],
    })
    assert.equal(score, 50)
  })

  it('adds points for email open and subtracts for unsubscribe', () => {
    const score = computeCrmLeadScore(entry({ crm: { unsubscribedAt: '2026-01-01T00:00:00Z' } }), {
      marketingEvents: [{ leadId: 'lead-1', type: 'open' }],
    })
    assert.ok(score >= 0)
    assert.ok(score < 80)
  })

  it('matches pricing page visits from site tracking events', () => {
    const score = computeCrmLeadScore(entry(), {
      marketingEvents: [
        { leadId: 'lead-1', type: 'site_pageview', url: 'https://acme.example/pricing' },
      ],
    })
    const without = computeCrmLeadScore(entry(), { marketingEvents: [] })
    assert.ok(score > without)
  })

  it('falls back to default rules when org has none', () => {
    const rules = getOrgScoringRules({ organizations: [{ id: 'org-1', crmSettings: {} }] }, 'org-1')
    assert.equal(rules.length, DEFAULT_SCORING_RULES.length)
  })
})
