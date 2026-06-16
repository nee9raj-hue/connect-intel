import assert from 'node:assert/strict'
import { pipelineEntryMatchesSearch } from '../lib/server/pipelineQuery.js'

const entry = {
  lead: {
    name: 'ZENITH DRINKS PRIVATE LIMITED',
    email: 'info@zenith.example',
  },
  crm: { status: 'new' },
}

assert.equal(pipelineEntryMatchesSearch(entry, 'ZENITH DRINKS'), true)
assert.equal(pipelineEntryMatchesSearch(entry, 'zenith drinks private'), true)
assert.equal(pipelineEntryMatchesSearch({ lead: { company: 'Acme Corp' } }, 'acme'), true)
assert.equal(pipelineEntryMatchesSearch(entry, 'not found'), false)

console.log('pipeline search tests passed')
