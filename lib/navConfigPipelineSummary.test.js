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

test('bumpPipelineSummaryStatus shifts counts between CRM statuses', () => {
  const next = bumpPipelineSummaryStatus(baseSummary, 'replied', 'follow_up')
  const followUp = next.byStatus.find((r) => r.status === 'follow_up')
  const replied = next.byStatus.find((r) => r.status === 'replied')
  assert.equal(followUp?.count, 7)
  assert.equal(replied?.count, 1)
  assert.equal(next.total, 12)
})

test('bumpPipelineSummaryStatus is a no-op for identical statuses', () => {
  const next = bumpPipelineSummaryStatus(baseSummary, 'replied', 'replied')
  assert.deepEqual(next.byStatus, baseSummary.byStatus)
})
