import assert from 'node:assert/strict'
import test from 'node:test'
import { bumpPipelineSummaryStatus, normalizePipelineSummary } from './pipelineSidebarSummary.js'

const baseSummary = normalizePipelineSummary({
  total: 12,
  byStatus: [
    { status: 'new', count: 4 },
    { status: 'follow_up', count: 6 },
    { status: 'replied', count: 2 },
  ],
})

test('normalizePipelineSummary folds legacy CRM statuses', () => {
  const unqualified = baseSummary.byStatus.find((r) => r.status === 'unqualified')
  const opportunity = baseSummary.byStatus.find((r) => r.status === 'opportunity')
  assert.equal(unqualified?.count, 4)
  assert.equal(opportunity?.count, 8)
})

test('bumpPipelineSummaryStatus shifts counts between CRM statuses', () => {
  const next = bumpPipelineSummaryStatus(baseSummary, 'new', 'opportunity')
  const unqualified = next.byStatus.find((r) => r.status === 'unqualified')
  const opportunity = next.byStatus.find((r) => r.status === 'opportunity')
  assert.equal(unqualified?.count, 3)
  assert.equal(opportunity?.count, 9)
  assert.equal(next.total, 12)
})

test('bumpPipelineSummaryStatus is a no-op for identical canonical statuses', () => {
  const next = bumpPipelineSummaryStatus(baseSummary, 'replied', 'follow_up')
  assert.deepEqual(next.byStatus, baseSummary.byStatus)
})
