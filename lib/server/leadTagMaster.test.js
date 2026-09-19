import test from 'node:test'
import assert from 'node:assert/strict'
import { leadTagToMasterRow, masterRowToLeadTag } from './leadTagMaster.js'

test('leadTagToMasterRow maps org JSON tags onto lead_tag_master columns', () => {
  const row = leadTagToMasterRow('org_xindus', {
    id: 'tag_eqy',
    name: 'EQY',
    color: '#2563eb',
    teamId: 'team-sales',
    source: 'org_team',
    createdByUserId: 'user_1',
    createdAt: '2026-09-01T00:00:00.000Z',
  })
  assert.equal(row.id, 'tag_eqy')
  assert.equal(row.organization_id, 'org_xindus')
  assert.equal(row.name, 'EQY')
  assert.equal(row.name_slug, 'eqy')
  assert.equal(row.team_id, 'team-sales')
  assert.equal(row.source, 'org_team')
})

test('masterRowToLeadTag round-trips for pipeline tag filters', () => {
  const tag = masterRowToLeadTag({
    id: 'tag_eqy',
    name: 'EQY',
    color: '#2563eb',
    team_id: null,
    source: null,
    engagement_slug: null,
    created_at: '2026-09-01T00:00:00.000Z',
    created_by_user_id: 'user_1',
  })
  assert.equal(tag.id, 'tag_eqy')
  assert.equal(tag.name, 'EQY')
  assert.equal(tag.createdByUserId, 'user_1')
})
