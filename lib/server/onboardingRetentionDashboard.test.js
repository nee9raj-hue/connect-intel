import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOnboardingRetentionReport,
  matchOnboardingRetentionFilters,
  onboardedAtMs,
} from './onboardingRetentionDashboard.js'

const TZ = 'Asia/Kolkata'

function row({ company, owner, teamId, firstShipmentAt, savedAt }) {
  return {
    owner_id: owner,
    team_id: teamId,
    lead_id: `lead_${company}`,
    entry: {
      assignedToUserId: owner,
      teamId,
      savedAt,
      tradingProfile: firstShipmentAt ? { firstShipmentAt } : {},
      lead: { id: `lead_${company}`, company },
    },
  }
}

describe('onboardingRetentionDashboard', () => {
  it('prefers first shipment over savedAt', () => {
    const ms = onboardedAtMs({
      savedAt: '2026-01-01T00:00:00.000Z',
      tradingProfile: { firstShipmentAt: '2026-09-03T00:00:00.000Z' },
    })
    assert.equal(new Date(ms).toISOString().slice(0, 10), '2026-09-03')
  })

  it('counts unique companies once per onboarding week against each team', () => {
    const rows = [
      row({
        company: 'Zenith Drinks',
        owner: 'u1',
        teamId: 't-ocean',
        firstShipmentAt: '2026-09-03T00:00:00.000Z',
      }),
      row({
        company: 'ZENITH DRINKS PRIVATE LIMITED',
        owner: 'u1',
        teamId: 't-ocean',
        firstShipmentAt: '2026-09-03T00:00:00.000Z',
      }),
      row({
        company: 'Acme',
        owner: 'u2',
        teamId: 't-air',
        savedAt: '2026-09-16T00:00:00.000Z',
      }),
    ]
    const report = buildOnboardingRetentionReport(rows, {
      year: 2026,
      month: 9,
      timeZone: TZ,
      teamNames: { 't-ocean': 'Ocean', 't-air': 'Air' },
      teamCatalog: [
        { teamId: 't-ocean', teamName: 'Ocean' },
        { teamId: 't-air', teamName: 'Air' },
      ],
    })
    assert.equal(report.totals.onboarded, 2)
    assert.equal(report.teams.length, 2)
    assert.equal(report.teams.find((t) => t.teamName === 'Ocean').onboarded, 1)
    assert.equal(report.teams.find((t) => t.teamName === 'Air').onboarded, 1)
    assert.equal(report.groups.length, 2)
  })

  it('filters by team and owner', () => {
    const r = row({
      company: 'Acme',
      owner: 'u1',
      teamId: 't-air',
      savedAt: '2026-09-16T00:00:00.000Z',
    })
    assert.equal(matchOnboardingRetentionFilters(r.entry, r, { teamIds: ['t-air'] }), true)
    assert.equal(matchOnboardingRetentionFilters(r.entry, r, { teamIds: ['t-ocean'] }), false)
    assert.equal(matchOnboardingRetentionFilters(r.entry, r, { ownerIds: ['u2'] }), false)
  })
})
