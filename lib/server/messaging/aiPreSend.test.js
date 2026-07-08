import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { inspectMessageBeforeSend } from './aiPreSend.js'

describe('inspectMessageBeforeSend', () => {
  it('flags missing subject and unresolved variables', () => {
    const result = inspectMessageBeforeSend({
      subject: '',
      body: 'Hi {{FirstName}}',
      lead: { firstName: 'Ada' },
      variables: ['FirstName'],
    })
    assert.equal(result.ok, false)
    assert.ok(result.issues.some((i) => i.type === 'missing_subject'))
    assert.ok(result.issues.some((i) => i.type === 'missing_variable'))
  })

  it('suggests CTA when absent', () => {
    const result = inspectMessageBeforeSend({
      subject: 'Hello',
      body: 'We offer logistics services for exporters.',
      lead: { firstName: 'Ada' },
    })
    assert.ok(result.suggestions.some((s) => s.type === 'cta'))
  })
})
