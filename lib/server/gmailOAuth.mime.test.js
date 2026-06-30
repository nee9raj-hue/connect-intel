import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRawMime } from './gmailOAuth.js'

test('buildRawMime encodes UTF-8 body as base64, not MIME encoded-word', () => {
  const raw = buildRawMime({
    from: '"Connect Intel" <invite@connectintel.net>',
    to: 'rep@example.com',
    subject: 'Neeraj assigned you a lead',
    text: 'Plain text with bullet: - Review the lead.',
    html: '<div><p>Hi there</p><p>Suggested: - Review profile</p></div>',
    replyTo: 'neeraj@example.com',
  })

  assert.ok(raw.includes('Subject: Neeraj assigned you a lead'))
  assert.ok(raw.includes('Content-Transfer-Encoding: 7bit'))
  assert.ok(!raw.includes('Content-Transfer-Encoding: 7bit\r\n\r\n=?UTF-8?B?'))
  assert.ok(raw.includes('<div><p>Hi there</p>'))
})

test('buildRawMime base64-encodes non-ASCII HTML body parts', () => {
  const raw = buildRawMime({
    from: '"Connect Intel" <invite@connectintel.net>',
    to: 'rep@example.com',
    subject: 'Test',
    text: 'Plain',
    html: '<p>Unicode bullet: • item</p>',
    replyTo: 'admin@example.com',
  })

  assert.ok(raw.includes('Content-Transfer-Encoding: base64'))
  assert.ok(!raw.match(/text\/html[\s\S]*=\?UTF-8\?B\?/))
})
