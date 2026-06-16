import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPipelineLeadRow,
  buildPipelineLeadRowCore,
} from './pipelineLeadsTable.js'

const entry = {
  organizationId: 'org1',
  userId: 'user1',
  assignedToUserId: 'rep2',
  lead: {
    id: 'lead-1',
    company: 'HOME CRAFTS',
    email: 'homedecorcrafts2023@gmail.com',
    phone: '+91-77428-71273',
  },
  crm: {
    status: 'follow_up',
    deals: [{ id: 'deal-1' }],
  },
}

test('buildPipelineLeadRowCore omits denormalized columns', () => {
  const row = buildPipelineLeadRowCore('pipeline_org_org1', entry)
  assert.equal(row.lead_id, 'lead-1')
  assert.equal(row.entry.lead.email, 'homedecorcrafts2023@gmail.com')
  assert.equal(row.email, undefined)
  assert.equal(row.owner_id, undefined)
  assert.equal(row.deal_count, undefined)
})

test('buildPipelineLeadRow includes denormalized columns when requested', () => {
  const row = buildPipelineLeadRow('pipeline_org_org1', entry, { denormalized: true })
  assert.equal(row.email, 'homedecorcrafts2023@gmail.com')
  assert.equal(row.owner_id, 'rep2')
  assert.equal(row.deal_count, 1)
})

test('buildPipelineLeadRow defaults to core-only for runtime upserts', () => {
  const row = buildPipelineLeadRow('pipeline_org_org1', entry, { denormalized: false })
  assert.equal(row.email, undefined)
  assert.ok(row.entry.crm.deals.length === 1)
})
