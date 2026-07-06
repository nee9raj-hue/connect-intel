import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyWorkflowRules } from './crmWorkflowRules.js'

describe('applyWorkflowRules fired tracking', () => {
  it('records fired CRM rules on matching status_enter', () => {
    const orgId = 'org-1'
    const store = {
      organizations: [
        {
          id: orgId,
          crmSettings: {
            workflowRules: [
              {
                id: 'rule-1',
                name: 'Replied task',
                enabled: true,
                trigger: 'status_enter',
                status: 'replied',
                actions: [{ type: 'add_note', summary: 'Follow up' }],
              },
            ],
            visualWorkflows: [],
          },
        },
      ],
    }
    const entry = {
      lead: { id: 'lead-1' },
      crm: { status: 'new', deals: [], activities: [], tasks: [], meetings: [] },
    }

    const fired = applyWorkflowRules(store, entry, {
      trigger: 'status_change',
      newStatus: 'replied',
      organizationId: orgId,
      actor: { id: 'u1', name: 'Rep' },
    })

    assert.equal(fired.length, 1)
    assert.equal(fired[0].workflowKey, 'rule-1')
    assert.equal(fired[0].workflowType, 'crm_rule')
  })
})
