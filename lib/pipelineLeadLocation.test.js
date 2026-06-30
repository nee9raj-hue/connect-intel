import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getLeadStateFromFields,
  leadMatchesStateFilters,
  locationMatchesField,
  parseLeadLocationFields,
} from './pipelineLeadLocation.js'

test('parseLeadLocationFields prefers location state over stale state field', () => {
  const lead = { state: 'GUJRAT', location: 'RAJASTHAN' }
  assert.equal(parseLeadLocationFields(lead).state, 'Rajasthan')
  assert.equal(getLeadStateFromFields(lead), 'Rajasthan')
})

test('parseLeadLocationFields parses city, state from comma location', () => {
  const lead = { location: 'Jaipur, Rajasthan' }
  assert.deepEqual(parseLeadLocationFields(lead), { city: 'Jaipur', state: 'Rajasthan' })
})

test('locationMatchesField normalizes GUJRAT to Gujarat', () => {
  assert.equal(locationMatchesField('Gujarat', 'GUJRAT'), true)
  assert.equal(locationMatchesField('Rajasthan', 'GUJRAT'), false)
})

test('leadMatchesStateFilters excludes Rajasthan when filtering GUJRAT', () => {
  const lead = { state: 'GUJRAT', location: 'RAJASTHAN' }
  assert.equal(leadMatchesStateFilters(lead, ['GUJRAT']), false)
  assert.equal(leadMatchesStateFilters(lead, ['Rajasthan']), true)
})

test('leadMatchesStateFilters includes Gujarat leads for GUJRAT filter', () => {
  const lead = { state: 'GUJRAT', location: 'Surat, Gujarat' }
  assert.equal(leadMatchesStateFilters(lead, ['GUJRAT']), true)
})

test('leadMatchesStateFilters matches Delhi city field to Delhi NCR filter', () => {
  const lead = { city: 'New Delhi', state: '', location: '' }
  assert.equal(leadMatchesStateFilters(lead, ['Delhi NCR']), true)
  assert.equal(leadMatchesStateFilters(lead, ['Delhi']), true)
})
