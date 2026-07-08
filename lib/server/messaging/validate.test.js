import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isValidEmailFormat } from './validate.js'

describe('messaging validate', () => {
  it('validates email format helper', () => {
    assert.equal(isValidEmailFormat('test@company.com'), true)
    assert.equal(isValidEmailFormat('not-an-email'), false)
    assert.equal(isValidEmailFormat(''), false)
  })
})
