import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { organizationRecordFromSqlRow, pickCanonicalAuthProfile, userRecordFromProfileRow } from './storeUserLookup.js'

describe('storeUserLookup mapping', () => {
  it('rebuilds a CRM user from a profiles SQL row without the users blob', () => {
    const organization = organizationRecordFromSqlRow({
      id: '11111111-2222-4333-8444-555555555555',
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
    assert.equal(user.organizationUuid, '11111111-2222-4333-8444-555555555555')
    assert.equal(user.accountType, 'company')
    assert.equal(user.pipelineRole, 'org_admin')
    assert.equal(user.onboardingComplete, true)
    assert.equal(organization.name, 'Xindus Network Trade')
  })

  it('picks the teamed CRM profile when the same email has a login duplicate', () => {
    const emptyLogin = {
      legacy_user_id: 'user_4129a563-f77b-42bf-bb36-2559a5fc1546',
      email: 'kuldeep@xindus.net',
      full_name: 'Kuldeep Sharma',
      pipeline_role: 'member\n',
      team_id: null,
    }
    const crmBook = {
      legacy_user_id: 'user_cdcaa5cd-b162-43f3-ad10-8253a0e4fba6',
      email: 'kuldeep@xindus.net',
      full_name: 'Kuldeep Sharma',
      pipeline_role: 'member',
      team_id: '3ccc91ea-a646-4f5d-b896-6f2b13644838',
    }
    const picked = pickCanonicalAuthProfile([emptyLogin, crmBook])
    assert.equal(picked.legacy_user_id, crmBook.legacy_user_id)
    const user = userRecordFromProfileRow(picked, null, { siblingProfiles: [emptyLogin, crmBook] })
    assert.equal(user.id, crmBook.legacy_user_id)
    assert.equal(user.pipelineRole, 'member')
    assert.deepEqual(
      new Set(user.pipelineActorIds),
      new Set([emptyLogin.legacy_user_id, crmBook.legacy_user_id])
    )
  })
})
