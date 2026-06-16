import assert from 'node:assert/strict'
import {
  sanitizeEmailSubject,
  wrapOrgNotificationHtml,
} from '../lib/server/orgNotificationEmailLayout.js'

assert.equal(sanitizeEmailSubject("Today's schedule — 2 items"), "Today's schedule - 2 items")
assert.equal(sanitizeEmailSubject('Task in 30 min: Brief ocean'), 'Task in 30 min: Brief ocean')
assert.equal(sanitizeEmailSubject('Hello → World · test'), 'Hello -> World - test')
assert.ok(!sanitizeEmailSubject('Test — dash').includes('—'))

const wrapped = wrapOrgNotificationHtml('<p>Body</p>')
assert.ok(wrapped.includes('connect-intel-logo-icon-light.png'))
assert.ok(wrapped.includes('data-ci-org-notification="1"'))
assert.ok(wrapped.includes('<p>Body</p>'))

console.log('orgNotificationEmailLayout tests passed')
