import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { assertPipelineStoreTenant, stampPipelineEntryOrg } from './tenantWriteGuard.js'

describe('stampPipelineEntryOrg', () => {
  it('stamps organizationId from user when missing', () => {
    const entry = { id: 'e1' }
    stampPipelineEntryOrg({ organizationId: 'org1' }, entry)
    assert.equal(entry.organizationId, 'org1')
  })

  it('does not overwrite existing organizationId', () => {
    const entry = { id: 'e1', organizationId: 'org_existing' }
    stampPipelineEntryOrg({ organizationId: 'org1' }, entry)
    assert.equal(entry.organizationId, 'org_existing')
  })
})

describe('assertPipelineStoreTenant', () => {
  it('blocks cross-tenant pipeline writes', () => {
    const store = {
      savedLeads: [{ id: 'e1', organizationId: 'org_other' }],
    }
    assert.throws(
      () => assertPipelineStoreTenant({ organizationId: 'org1' }, store),
      /Cross-tenant pipeline write blocked/
    )
  })

  it('stamps missing organizationId on entries', () => {
    const store = { savedLeads: [{ id: 'e1' }] }
    assertPipelineStoreTenant({ organizationId: 'org1' }, store)
    assert.equal(store.savedLeads[0].organizationId, 'org1')
  })

  it('no-op for solo users without organizationId', () => {
    const store = { savedLeads: [{ id: 'e1' }] }
    assert.doesNotThrow(() => assertPipelineStoreTenant({ id: 'u1' }, store))
    assert.equal(store.savedLeads[0].organizationId, undefined)
  })
})
