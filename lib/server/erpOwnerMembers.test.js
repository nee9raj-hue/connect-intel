import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { collectErpOwnerPeople, ensureErpOwnerMemberships } from './erpOwnerMembers.js'

describe('ensureErpOwnerMemberships', () => {
  it('collects unique ERP owner emails without writing the users blob', async () => {
    const overlays = [
      { erp: { ownership: { salesOwner: { email: 'vivek@xindus.net', name: 'Vivek' } } } },
      { erp: { ownership: { salesOwner: { email: 'vivek@xindus.net', name: 'Vivek Kumar' } } } },
    ]
    assert.equal(collectErpOwnerPeople(overlays).length, 1)
    const result = await ensureErpOwnerMemberships('org1', overlays)
    assert.equal(result.created, 0)
    assert.equal(result.linked, 0)
    assert.equal(result.skipped, true)
    assert.equal(result.people, 1)
  })
})
