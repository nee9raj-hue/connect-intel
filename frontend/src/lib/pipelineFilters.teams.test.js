import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPipelineFilters } from './pipelineFilters.js'
import { consumeTeamScopedLeadTags } from '../../../lib/pipelineMemberVisibility.js'

test('pipeline team filter matches sales owner like tags, even if lead.teamId differs', () => {
  const leads = [
    { id: 'chuninda', teamId: null, assignedToUserId: 'user_lokesh', crm: {} },
    { id: 'other', teamId: 'team-sales', assignedToUserId: 'user_vivek', crm: {} },
  ]
  const out = applyPipelineFilters(leads, {
    teamIds: ['team-sales'],
    teamMemberUserIds: ['user_lokesh'],
  })
  assert.deepEqual(out.map((l) => l.id), ['chuninda'])
})

test('Non Large B2B team tag in More filters does not hide Vivek leads that lack the tag', () => {
  const tags = [{ id: 'tag-b2b', name: 'Non Large B2B', teamId: 'team-b2b', source: 'org_team' }]
  const consumed = consumeTeamScopedLeadTags(['tag-b2b'], tags, ['team-b2b'])
  const leads = [
    { id: 'dakash-lead', assignedToUserId: 'dakash', crm: { tagIds: ['tag-b2b'] } },
    { id: 'vivek-lead', assignedToUserId: 'vivek', crm: { tagIds: [] } },
  ]
  const out = applyPipelineFilters(leads, {
    tagIds: consumed.tagIds,
    teamIds: consumed.teamIds,
    teamMemberUserIds: ['dakash', 'vivek'],
  })
  assert.deepEqual(out.map((l) => l.id).sort(), ['dakash-lead', 'vivek-lead'])
})

test('pipeline search matches a contact name without throwing', () => {
  const leads = [
    { id: '1', firstName: 'Neeraj', lastName: 'Kumar', company: 'Xindus', email: 'neeraj@xindus.net' },
    { id: '2', firstName: 'Other', lastName: 'Rep', company: 'Acme' },
  ]
  const out = applyPipelineFilters(leads, { search: 'neeraj' })
  assert.deepEqual(out.map((l) => l.id), ['1'])
})

test('pipeline contact filter uses email/phone helpers without throwing', () => {
  const leads = [
    { id: 'email', email: 'ok@xindus.net' },
    { id: 'phone', phone: '9876543210' },
  ]
  const withEmail = applyPipelineFilters(leads, { contact: 'has_email' })
  const withPhone = applyPipelineFilters(leads, { contact: 'has_phone' })
  assert.deepEqual(withEmail.map((l) => l.id), ['email'])
  assert.deepEqual(withPhone.map((l) => l.id), ['phone'])
})
