import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { inferBusinessGoal, buildApproachPlanSteps } from './businessGoal.js'

describe('businessGoal', () => {
  it('infers lead generation goal', () => {
    assert.equal(inferBusinessGoal('lead_generation'), 'generate qualified outbound sales leads')
  })

  it('builds approach plan steps for lead discovery', () => {
    const steps = buildApproachPlanSteps('lead_generation')
    assert.ok(steps.some((s) => s.label.includes('Ranking')))
    assert.ok(steps[0].label.includes('Understanding'))
  })
})
