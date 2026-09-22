import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createOrgLeadTag,
  mergeVisibleLeadTagIds,
  visibleLeadTagIdsForUser,
} from './orgLeadTags.js'

function miniStore(orgId, tags = []) {
  return {
    organizations: [{ id: orgId, name: 'Xindus', leadTags: tags }],
  }
}

describe('personal lead tags', () => {
  it('lets two reps create the same personal tag name', () => {
    const store = miniStore('org1')
    const kuldeep = createOrgLeadTag(store, 'org1', { name: 'Follow up', personal: true }, 'user_kuldeep')
    const vivek = createOrgLeadTag(store, 'org1', { name: 'Follow up', personal: true }, 'user_vivek')
    assert.equal(kuldeep.source, 'personal')
    assert.equal(vivek.source, 'personal')
    assert.notEqual(kuldeep.id, vivek.id)
  })

  it('blocks a personal tag that collides with a company tag name', () => {
    const store = miniStore('org1')
    createOrgLeadTag(store, 'org1', { name: 'VIP' }, 'admin')
    assert.throws(
      () => createOrgLeadTag(store, 'org1', { name: 'VIP', personal: true }, 'user_kuldeep'),
      /already exists/
    )
  })

  it('hides another rep personal tag from GET-style visibility and preserves it on merge', () => {
    const store = miniStore('org1', [
      { id: 'tag-org', name: 'B2B', source: null },
      { id: 'tag-k', name: 'Mine', source: 'personal', createdByUserId: 'user_kuldeep' },
      { id: 'tag-v', name: 'Mine', source: 'personal', createdByUserId: 'user_vivek' },
    ])
    const kuldeep = { id: 'user_kuldeep' }
    const visible = new Set(visibleLeadTagIdsForUser(store, 'org1', kuldeep))
    assert.equal(visible.has('tag-org'), true)
    assert.equal(visible.has('tag-k'), true)
    assert.equal(visible.has('tag-v'), false)
    const merged = mergeVisibleLeadTagIds(['tag-org'], ['tag-org', 'tag-v'], [...visible])
    assert.deepEqual(new Set(merged), new Set(['tag-org', 'tag-v']))
  })
})
