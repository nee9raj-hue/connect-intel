import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isTrailGmailMessage } from '../../lib/emailTrail.js'

function msg(from, to, extra = {}) {
  return {
    id: extra.id || 'm1',
    threadId: extra.threadId || 't1',
    payload: {
      headers: [
        { name: 'From', value: from },
        { name: 'To', value: to },
      ],
    },
  }
}

describe('emailTrail inbound seed', () => {
  it('allows inbound reply before CRM outbound is logged', () => {
    const ctx = {
      leadEmail: 'sales@alvarfresh.com',
      userEmail: 'neeraj.kumar@xindus.net',
      trailThreadIds: new Set(),
      knownGmailIds: new Set(),
      hasCrmOutbound: false,
    }
    const inbound = msg('sales@alvarfresh.com', 'neeraj.kumar@xindus.net')
    assert.equal(isTrailGmailMessage(inbound, ctx), true)
  })

  it('allows outbound seed from rep to lead', () => {
    const ctx = {
      leadEmail: 'sales@alvarfresh.com',
      userEmail: 'neeraj.kumar@xindus.net',
      trailThreadIds: new Set(),
      knownGmailIds: new Set(),
      hasCrmOutbound: false,
    }
    const outbound = msg('neeraj.kumar@xindus.net', 'sales@alvarfresh.com')
    assert.equal(isTrailGmailMessage(outbound, ctx), true)
  })
})
