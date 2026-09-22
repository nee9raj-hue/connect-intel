import assert from 'node:assert/strict'
import {
  buildPipelineSearchPostgrestOr,
  escapePostgrestIlike,
} from '../lib/server/pipelineTableSearch.js'

assert.equal(escapePostgrestIlike('100%'), '100\\%')
assert.equal(buildPipelineSearchPostgrestOr('a'), null)
assert.equal(buildPipelineSearchPostgrestOr(''), null)

const clause = buildPipelineSearchPostgrestOr('ZENITH DRINKS')
assert.ok(clause?.startsWith('and=('), 'multi-word search requires every word')
assert.ok(clause.includes('entry->lead->>company.ilike.'), 'company field')
assert.ok(clause.includes('email.ilike.'), 'email field')
assert.ok(clause.includes('ZENITH'), 'first word')
assert.ok(clause.includes('DRINKS'), 'second word')
assert.equal(clause.includes('%20'), false, 'word patterns must not contain a space')

const multi = buildPipelineSearchPostgrestOr('acme, zenith')
assert.ok(multi.includes('acme'), 'first term')
assert.ok(multi.includes('zenith'), 'second term')

const phone = buildPipelineSearchPostgrestOr('9876543210')
assert.ok(phone.includes('phone.ilike.'), 'phone digits search')

console.log('test-pipeline-table-search: ok')
