import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapPipelineRoleToSql } from './memberHierarchySync.js'

describe('mapPipelineRoleToSql', () => {
  it('maps org_admin to admin', () => {
    assert.equal(mapPipelineRoleToSql('org_admin'), 'admin')
  })

  it('maps manager', () => {
    assert.equal(mapPipelineRoleToSql('manager'), 'manager')
  })

  it('defaults to rep', () => {
    assert.equal(mapPipelineRoleToSql('member'), 'rep')
  })
})
