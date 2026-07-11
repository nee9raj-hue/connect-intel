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

  it('records fired CRM rules on lead_created', () => {
    const orgId = 'org-1'
    const store = {
      organizations: [
        {
          id: orgId,
          crmSettings: {
            workflowRules: [
              {
                id: 'rule-new',
                name: 'Welcome task',
                enabled: true,
                trigger: 'lead_created',
                actions: [{ type: 'add_task', title: 'Intro call', dueDays: 2 }],
              },
            ],
            visualWorkflows: [],
          },
        },
      ],
    }
    const entry = {
      lead: { id: 'lead-2' },
      crm: { status: 'new', deals: [], activities: [], tasks: [], meetings: [] },
    }

    const fired = applyWorkflowRules(store, entry, {
      trigger: 'lead_created',
      organizationId: orgId,
      actor: { id: 'u1', name: 'Rep' },
    })

    assert.equal(fired.length, 1)
    assert.equal(fired[0].workflowKey, 'rule-new')
    assert.equal(fired[0].trigger, 'lead_created')
  })

  it('skips no_activity_days rules below threshold', () => {
    const orgId = 'org-1'
    const store = {
      organizations: [
        {
          id: orgId,
          crmSettings: {
            workflowRules: [
              {
                id: 'rule-stale',
                name: 'Stale nudge',
                enabled: true,
                trigger: 'no_activity_days',
                days: 14,
                actions: [{ type: 'add_note', summary: 'Check in' }],
              },
            ],
            visualWorkflows: [],
          },
        },
      ],
    }
    const entry = {
      lead: { id: 'lead-3' },
      crm: { status: 'new', deals: [], activities: [], tasks: [], meetings: [] },
    }

    const fired = applyWorkflowRules(store, entry, {
      trigger: 'no_activity_days',
      organizationId: orgId,
      actor: { id: 'system', name: 'Workflow cron' },
      meta: { inactiveDays: 10 },
    })

    assert.equal(fired.length, 0)
    assert.equal(entry.crm.activities.length, 0)
  })

  it('fires no_activity_days rules at threshold', () => {
    const orgId = 'org-1'
    const store = {
      organizations: [
        {
          id: orgId,
          crmSettings: {
            workflowRules: [
              {
                id: 'rule-stale',
                name: 'Stale nudge',
                enabled: true,
                trigger: 'no_activity_days',
                days: 14,
                actions: [{ type: 'add_note', summary: 'Check in' }],
              },
            ],
            visualWorkflows: [],
          },
        },
      ],
    }
    const entry = {
      lead: { id: 'lead-4' },
      crm: { status: 'new', deals: [], activities: [], tasks: [], meetings: [] },
    }

    const fired = applyWorkflowRules(store, entry, {
      trigger: 'no_activity_days',
      organizationId: orgId,
      actor: { id: 'system', name: 'Workflow cron' },
      meta: { inactiveDays: 14 },
    })

    assert.equal(fired.length, 1)
    assert.equal(fired[0].trigger, 'no_activity_days')
    assert.equal(entry.crm.activities.length, 1)
  })
})
