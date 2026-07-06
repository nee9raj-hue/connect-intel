import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { recordMarketingAudit } from './auditMarketing.js'

describe('recordMarketingAudit', () => {
  it('no-ops without action or resourceId', () => {
    assert.doesNotThrow(() => recordMarketingAudit({}))
    assert.doesNotThrow(() => recordMarketingAudit({ action: 'marketing.campaign_created' }))
  })
})
