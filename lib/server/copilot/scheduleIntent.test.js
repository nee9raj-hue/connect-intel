import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseDueFromMessage, parseTaskTitle } from './scheduleIntent.js'

describe('scheduleIntent', () => {
  const now = new Date('2026-07-07T10:00:00.000Z')

  it('parses tomorrow due date', () => {
    const iso = parseDueFromMessage('remind me tomorrow', now)
    assert.ok(iso)
    assert.ok(new Date(iso) > now)
  })

  it('parses task title from natural language', () => {
    assert.equal(parseTaskTitle('Remind me to call about pricing tomorrow'), 'call about pricing')
  })
})
