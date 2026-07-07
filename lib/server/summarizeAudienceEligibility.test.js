import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeAudienceEligibility } from './marketingCampaigns.js'

const orgUser = {
  id: 'admin1',
  organizationId: 'org1',
  accountType: 'company',
  orgRole: 'org_admin',
  isOrgAdmin: true,
}

function pipelineEntry(leadId, email, leadExtra = {}) {
  return {
    organizationId: 'org1',
    userId: 'admin1',
    lead: {
      id: leadId,
      email,
      commercialEmailOptIn: true,
      emailStatus: 'valid',
      ...leadExtra,
    },
  }
}

function storeWith(entries, suppressions = []) {
  return {
    users: [],
    organizations: [{ id: 'org1', accountType: 'company', ownerUserId: 'admin1' }],
    organizationMemberships: [],
    savedLeads: entries,
    marketingSuppressions: suppressions,
  }
}

describe('summarizeAudienceEligibility', () => {
  it('counts eligible leads with consent and valid email', () => {
    const store = storeWith([
      pipelineEntry('l1', 'alice@gmail.com'),
      pipelineEntry('l2', 'bob@gmail.com'),
    ])
    const summary = summarizeAudienceEligibility(store, orgUser, ['l1', 'l2', 'l1'])
    assert.deepEqual(summary, {
      total: 2,
      eligible: 2,
      skipped: { not_in_pipeline: 0, no_email: 0, no_consent: 0, suppressed: 0 },
    })
  })

  it('skips leads missing from pipeline, email, consent, or suppression list', () => {
    const store = storeWith(
      [
        pipelineEntry('l1', 'good@gmail.com'),
        pipelineEntry('l2', 'n/a'),
        pipelineEntry('l3', 'noconsent@gmail.com', { commercialEmailOptIn: false }),
        pipelineEntry('l4', 'blocked@gmail.com'),
      ],
      [{ email: 'blocked@gmail.com', organizationId: 'org1' }]
    )
    const summary = summarizeAudienceEligibility(store, orgUser, [
      'l1',
      'l2',
      'l3',
      'l4',
      'missing',
    ])
    assert.equal(summary.total, 5)
    assert.equal(summary.eligible, 1)
    assert.equal(summary.skipped.not_in_pipeline, 1)
    assert.equal(summary.skipped.no_email, 1)
    assert.equal(summary.skipped.no_consent, 1)
    assert.equal(summary.skipped.suppressed, 1)
  })
})
