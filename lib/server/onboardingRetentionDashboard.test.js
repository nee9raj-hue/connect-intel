import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOnboardingRetentionReport,
  matchOnboardingRetentionFilters,
  onboardedAtMs,
} from './onboardingRetentionDashboard.js'
import { buildOwnerMemberIndex } from '../erpOwner.js'

const TZ = 'Asia/Kolkata'

function row({ company, owner, teamId, firstShipmentAt, customerCreatedAt, ownerEmail }) {
  return {
    owner_id: owner,
    team_id: teamId,
    lead_id: `lead_${company}`,
    entry: {
      assignedToUserId: owner,
      teamId,
      erp: {
        revenue: {
          firstShipmentAt,
          customerCreatedAt,
          onboardedAt: firstShipmentAt || customerCreatedAt,
        },
        ownership: ownerEmail ? { salesOwner: { name: owner, email: ownerEmail } } : {},
      },
      lead: { id: `lead_${company}`, company },
    },
  }
}

describe('onboardingRetentionDashboard', () => {
  it('uses ERP first shipment over created date', () => {
    const ms = onboardedAtMs({
      erp: {
        revenue: {
          customerCreatedAt: '2026-01-01',
          firstShipmentAt: '2026-09-03',
          onboardedAt: '2026-09-03',
        },
      },
    })
    assert.equal(new Date(ms).toISOString().slice(0, 10), '2026-09-03')
  })

  it('counts unique companies once per onboarding week against each team', () => {
    const ownerIndex = buildOwnerMemberIndex(
      {
        users: [
          { id: 'u1', email: 'ocean@x.test', name: 'Ocean rep' },
          { id: 'u2', email: 'air@x.test', name: 'Air rep' },
        ],
        organizationMemberships: [
          { userId: 'u1', organizationId: 'org', status: 'active' },
          { userId: 'u2', organizationId: 'org', status: 'active' },
        ],
      },
      'org'
    )
    const ownerTeamMap = { u1: 't-ocean', u2: 't-air' }
    const rows = [
      row({
        company: 'Zenith Drinks',
        owner: 'u1',
        ownerEmail: 'ocean@x.test',
        teamId: 't-ocean',
        firstShipmentAt: '2026-09-03T00:00:00.000Z',
      }),
      row({
        company: 'ZENITH DRINKS PRIVATE LIMITED',
        owner: 'u1',
        ownerEmail: 'ocean@x.test',
        teamId: 't-ocean',
        firstShipmentAt: '2026-09-03T00:00:00.000Z',
      }),
      row({
        company: 'Acme',
        owner: 'u2',
        ownerEmail: 'air@x.test',
        teamId: 't-air',
        customerCreatedAt: '2026-09-16T00:00:00.000Z',
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
      ownerIndex,
      ownerTeamMap,
    })
    assert.equal(report.totals.onboarded, 2)
    assert.equal(report.teams.length, 2)
    assert.equal(report.teams.find((t) => t.teamName === 'Ocean').onboarded, 1)
    assert.equal(report.teams.find((t) => t.teamName === 'Air').onboarded, 1)
  })

  it('filters by team and owner', () => {
    const r = row({
      company: 'Acme',
      owner: 'u1',
      ownerEmail: 'air@x.test',
      teamId: 't-air',
      customerCreatedAt: '2026-09-16T00:00:00.000Z',
    })
    const ownerIndex = buildOwnerMemberIndex(
      {
        users: [{ id: 'u1', email: 'air@x.test', name: 'Air' }],
        organizationMemberships: [{ userId: 'u1', organizationId: 'org', status: 'active' }],
      },
      'org'
    )
    const ownerTeamMap = { u1: 't-air' }
    assert.equal(
      matchOnboardingRetentionFilters(r.entry, r, { teamIds: ['t-air'] }, ownerIndex, ownerTeamMap),
      true
    )
    assert.equal(
      matchOnboardingRetentionFilters(r.entry, r, { teamIds: ['t-ocean'] }, ownerIndex, ownerTeamMap),
      false
    )
    assert.equal(
      matchOnboardingRetentionFilters(r.entry, r, { ownerIds: ['u2'] }, ownerIndex, ownerTeamMap),
      false
    )
  })
})
