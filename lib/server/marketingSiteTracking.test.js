import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyUtmAttribution,
  applyVisitorAttribution,
  createSiteKey,
  linkVisitorToLeadEvents,
  parseSiteKey,
  parseUtmParams,
  parseUtmFromFormBody,
  parseVisitorIdFromFormBody,
} from './marketingSiteTracking.js'
import { computeCrmLeadScore } from './crmScoringRules.js'

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

  it('links anonymous visitor pageviews to a lead', () => {
    const store = {
      marketingEvents: [
        {
          id: 'e1',
          organizationId: 'org-1',
          visitorId: 'v_abc',
          type: 'site_pageview',
          url: 'https://acme.test/pricing',
          createdAt: '2026-07-10T08:00:00.000Z',
        },
      ],
    }
    const linked = linkVisitorToLeadEvents(store, {
      organizationId: 'org-1',
      visitorId: 'v_abc',
      leadId: 'lead-1',
    })
    assert.equal(linked, 1)
    assert.equal(store.marketingEvents[0].leadId, 'lead-1')
  })

  it('scores pricing page visits via linked visitor id before leadId is stamped', () => {
    const entry = {
      lead: { id: 'lead-1', email: 'buyer@test.com' },
      crm: { visitorId: 'v_abc' },
    }
    const marketingEvents = [
      {
        organizationId: 'org-1',
        visitorId: 'v_abc',
        type: 'site_pageview',
        url: 'https://acme.test/pricing',
        createdAt: '2026-07-10T08:00:00.000Z',
      },
    ]
    const score = computeCrmLeadScore(entry, {
      store: { organizations: [{ id: 'org-1', crmSettings: {} }] },
      organizationId: 'org-1',
      marketingEvents,
    })
    assert.ok(score >= 80)
    const crm = applyVisitorAttribution(entry.crm, {
      visitorId: 'v_abc',
      organizationId: 'org-1',
      marketingEvents,
    })
    assert.equal(crm.marketingAttribution.lastTouch.url, 'https://acme.test/pricing')
  })

  it('parses visitor id from form body', () => {
    assert.equal(parseVisitorIdFromFormBody({ _ci_vid: 'v_form' }), 'v_form')
  })
})
