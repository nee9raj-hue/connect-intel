import assert from 'node:assert/strict'
import test from 'node:test'
import { filterPipelineEntriesByLeadIds } from './pipelineShard.js'

const entries = [
  { lead: { id: 'a1' }, crm: { status: 'new' } },
  { lead: { id: 'a2' }, crm: { status: 'won' } },
  { leadId: 'a3', crm: { status: 'follow_up' } },
]

test('filterPipelineEntriesByLeadIds returns matching rows only', () => {
  const out = filterPipelineEntriesByLeadIds(entries, ['a2', 'a3', 'missing'])
  assert.equal(out.length, 2)
  assert.equal(out[0].lead.id, 'a2')
  assert.equal(out[1].leadId, 'a3')
})

test('filterPipelineEntriesByLeadIds dedupes lead id list', () => {
  const out = filterPipelineEntriesByLeadIds(entries, ['a1', 'a1'])
  assert.equal(out.length, 1)
})
