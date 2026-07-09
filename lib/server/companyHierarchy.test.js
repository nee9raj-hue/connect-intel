import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  collectDescendantIds,
  enrichCompaniesHierarchy,
  rollupAccountMetrics,
  validateCompanyParentAssignment,
} from './companyHierarchy.js'

const tree = [
  { id: 'parent', name: 'Parent Co', leadCount: 2, openDeals: 1, wonDeals: 0, totalDealValue: 100 },
  {
    id: 'child_a',
    name: 'Child A',
    parentCompanyId: 'parent',
    leadCount: 3,
    openDeals: 2,
    wonDeals: 1,
    totalDealValue: 200,
  },
  {
    id: 'child_b',
    name: 'Child B',
    parentCompanyId: 'parent',
    leadCount: 1,
    openDeals: 0,
    wonDeals: 0,
    totalDealValue: 50,
  },
  {
    id: 'grandchild',
    name: 'Grandchild',
    parentCompanyId: 'child_a',
    leadCount: 4,
    openDeals: 1,
    wonDeals: 0,
    totalDealValue: 75,
  },
]

describe('companyHierarchy', () => {
  it('rolls up descendant metrics to parent', () => {
    const rollup = rollupAccountMetrics('parent', tree)
    assert.equal(rollup.leadCount, 10)
    assert.equal(rollup.openDeals, 4)
    assert.equal(rollup.wonDeals, 1)
    assert.equal(rollup.totalDealValue, 425)
  })

  it('enriches parent/child links and rollup fields', () => {
    const enriched = enrichCompaniesHierarchy(tree)
    const parent = enriched.find((c) => c.id === 'parent')
    assert.equal(parent.childCount, 2)
    assert.equal(parent.rollupLeadCount, 10)
    const child = enriched.find((c) => c.id === 'child_a')
    assert.equal(child.parentName, 'Parent Co')
    assert.equal(child.children.length, 1)
  })

  it('rejects circular parent assignment', () => {
    const verdict = validateCompanyParentAssignment(tree, 'parent', 'grandchild')
    assert.equal(verdict.ok, false)
    assert.match(verdict.error, /circular/i)
  })

  it('collectDescendantIds includes all nested children', () => {
    const ids = collectDescendantIds(tree, 'parent')
    assert.ok(ids.has('child_a'))
    assert.ok(ids.has('child_b'))
    assert.ok(ids.has('grandchild'))
    assert.equal(ids.size, 4)
  })
})
