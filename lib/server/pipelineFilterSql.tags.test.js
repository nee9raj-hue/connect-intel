import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendPipelineTagSqlParts,
  pipelineEntryTagContainsJson,
} from './pipelineFilterSql.js'

test('appendPipelineTagSqlParts — any mode uses or across tags', () => {
  const parts = appendPipelineTagSqlParts([], {
    tagIds: ['t1', 't2'],
    tagMode: 'any',
  })
  assert.equal(parts.length, 1)
  assert.match(parts[0], /^or=\(/)
  assert.match(parts[0], /t1/)
  assert.match(parts[0], /t2/)
})

test('appendPipelineTagSqlParts — all mode requires every tag', () => {
  const parts = appendPipelineTagSqlParts([], {
    tagIds: ['t1', 't2'],
    tagMode: 'all',
  })
  assert.equal(parts.length, 1)
  assert.match(parts[0], /^entry=cs\./)
  const json = decodeURIComponent(parts[0].replace(/^entry=cs\./, ''))
  assert.deepEqual(JSON.parse(json), { crm: { tagIds: ['t1', 't2'] } })
})

test('pipelineEntryTagContainsJson wraps tag ids under crm.tagIds', () => {
  assert.deepEqual(JSON.parse(pipelineEntryTagContainsJson(['abc'])), {
    crm: { tagIds: ['abc'] },
  })
})
