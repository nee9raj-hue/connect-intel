import test from 'node:test'
import assert from 'node:assert/strict'
import { isPipelineSearchBusy, shouldShowPipelineNoMatches } from './pipelineSearchBusy.js'

test('in-flight list fetch is busy even when the query already applied', () => {
  assert.equal(
    isPipelineSearchBusy({ search: 'acme', appliedSearch: 'acme', filterApplying: true }),
    true
  )
})

test('replacing a query is busy until debounce applies it', () => {
  assert.equal(
    isPipelineSearchBusy({ search: 'zenith', appliedSearch: 'acme', filterApplying: false }),
    true
  )
})

test('single character after a prior search stays busy so the list is not emptied', () => {
  assert.equal(
    isPipelineSearchBusy({ search: 'z', appliedSearch: 'acme', filterApplying: false }),
    true
  )
})

test('settled empty search is not busy', () => {
  assert.equal(
    isPipelineSearchBusy({ search: '', appliedSearch: '', filterApplying: false }),
    false
  )
})

test('no-matches empty state waits until search is idle', () => {
  assert.equal(
    shouldShowPipelineNoMatches({
      pipelineHasLeads: true,
      filteredCount: 0,
      searchBusy: true,
    }),
    false
  )
  assert.equal(
    shouldShowPipelineNoMatches({
      pipelineHasLeads: true,
      filteredCount: 0,
      searchBusy: false,
    }),
    true
  )
})
