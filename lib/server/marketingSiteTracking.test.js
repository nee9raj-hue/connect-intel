import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyUtmAttribution,
  createSiteKey,
  parseSiteKey,
  parseUtmParams,
  parseUtmFromFormBody,
} from './marketingSiteTracking.js'

describe('marketingSiteTracking', () => {
  it('round-trips site keys', () => {
    process.env.MARKETING_TRACK_SECRET = 'test-site-secret'
    const key = createSiteKey('org_test')
    assert.ok(key)
    const parsed = parseSiteKey(key)
    assert.equal(parsed.organizationId, 'org_test')
  })

  it('parses utm params', () => {
    const utm = parseUtmParams({
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'spring',
      junk: 'x',
    })
    assert.equal(utm.utm_source, 'google')
    assert.equal(utm.utm_medium, 'cpc')
    assert.equal(utm.utm_campaign, 'spring')
    assert.equal(utm.junk, undefined)
  })

  it('applies first and last touch attribution', () => {
    const first = applyUtmAttribution({}, { utm_source: 'newsletter' })
    assert.equal(first.marketingAttribution.firstTouch.utm_source, 'newsletter')
    const second = applyUtmAttribution(first, { utm_source: 'ads', utm_medium: 'cpc' })
    assert.equal(second.marketingAttribution.firstTouch.utm_source, 'newsletter')
    assert.equal(second.marketingAttribution.lastTouch.utm_source, 'ads')
  })

  it('parses utm json from form body', () => {
    const utm = parseUtmFromFormBody({
      _ci_utm: JSON.stringify({ utm_source: 'linkedin' }),
    })
    assert.equal(utm.utm_source, 'linkedin')
  })
})
