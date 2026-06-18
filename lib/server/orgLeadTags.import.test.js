import test from 'node:test'
import assert from 'node:assert/strict'
import { getValue } from './imports.js'
import { resolveOrgLeadTagIdsFromNames } from './orgLeadTags.js'
import { getOrganization } from './organizations.js'

function miniStore(orgId, tags = []) {
  return {
    organizations: [{ id: orgId, name: 'Test Org', leadTags: tags }],
    users: [],
    organizationMemberships: [],
  }
}

test('import row TAG column resolves via tag alias', () => {
  const row = { tag: 'EQY' }
  assert.equal(getValue(row, ['lead_tags', 'tags', 'tag_names', 'tag', 'lead_tag']), 'EQY')
})

test('resolveOrgLeadTagIdsFromNames creates missing tags on import', () => {
  const orgId = 'org-1'
  const store = miniStore(orgId)
  const ids = resolveOrgLeadTagIdsFromNames(store, orgId, 'EQY', {
    createMissing: true,
    actorUserId: 'admin-1',
  })
  assert.equal(ids.length, 1)
  const org = getOrganization(store, orgId)
  assert.equal(org.leadTags.length, 1)
  assert.equal(org.leadTags[0].name, 'EQY')
  assert.equal(ids[0], org.leadTags[0].id)
})
