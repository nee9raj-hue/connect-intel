import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { organizationRecordFromSqlRow, userRecordFromProfileRow } from './storeUserLookup.js'

describe('storeUserLookup mapping', () => {
  it('rebuilds a CRM user from a profiles SQL row without the users blob', () => {
    const organization = organizationRecordFromSqlRow({
      legacy_id: 'org-xindus',
      company_name: 'Xindus Network Trade',
      domain: 'xindus.net',
      account_type: 'company',
      metadata: { logoUrl: 'https://cdn/xindus.png' },
    })
    const user = userRecordFromProfileRow(
      {
        legacy_user_id: 'user-1',
        email: 'revenueb2b@xindus.net',
        full_name: 'Revenue B2B',
        role: 'admin',
        pipeline_role: 'org_admin',
        can_search: true,
        metadata: { accountType: 'company' },
      },
      organization
    )
    assert.equal(user.id, 'user-1')
    assert.equal(user.organizationId, 'org-xindus')
    assert.equal(user.accountType, 'company')
    assert.equal(user.pipelineRole, 'org_admin')
    assert.equal(user.onboardingComplete, true)
    assert.equal(organization.name, 'Xindus Network Trade')
  })
})
