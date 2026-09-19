import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  collectPipelineOrganizationIds,
  pipelineEntryInOrganization,
  postgrestOrgScopeFilter,
} from './pipelineOrgIdentity.js'
import { listPipelineSavedEntries } from './organizations.js'

describe('pipeline org identity', () => {
  it('keeps SQL rows visible when session org id and entry org id differ', () => {
    const user = {
      id: 'u-rev',
      organizationId: 'org-xindus',
      organizationUuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      accountType: 'company',
      orgRole: 'org_admin',
      isOrgAdmin: true,
    }
    const ids = collectPipelineOrganizationIds(user)
    assert.deepEqual(ids.sort(), ['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'org-xindus'].sort())
    assert.equal(
      pipelineEntryInOrganization({ organizationId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }, ids),
      true
    )

    const visible = listPipelineSavedEntries(
      {
        users: [user],
        organizations: [{ id: 'org-xindus', accountType: 'company', sqlOrganizationId: user.organizationUuid }],
        organizationMemberships: [
          { userId: user.id, organizationId: 'org-xindus', role: 'org_admin', status: 'active' },
        ],
        savedLeads: [
          {
            id: 'lead-1',
            organizationId: user.organizationUuid,
            lead: { id: 'lead-1', name: 'Acme' },
            savedAt: '2026-09-19T00:00:00.000Z',
          },
        ],
      },
      user
    )
    assert.equal(visible.length, 1)
    assert.equal(visible[0].lead.id, 'lead-1')
  })

  it('builds a PostgREST or-filter across legacy id, uuid, and shards', () => {
    const filter = postgrestOrgScopeFilter({
      organizationIds: ['org-xindus', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'],
      shardNames: ['pipeline_org_org-xindus', 'pipeline_org_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'],
    })
    assert.match(filter, /^or=\(/)
    assert.match(filter, /organization_id\.eq\.org-xindus/)
    assert.match(filter, /shard_name\.eq\.pipeline_org_org-xindus/)
  })
})
