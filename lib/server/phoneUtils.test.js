import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateMobileInput, validateOptionalMobileInput } from './phoneUtils.js'

describe('validateOptionalMobileInput', () => {
  it('allows blank mobile for login and signup', () => {
    assert.deepEqual(validateOptionalMobileInput(''), {
      ok: true,
      mobileE164: null,
      display: null,
    })
    assert.deepEqual(validateOptionalMobileInput('   '), {
      ok: true,
      mobileE164: null,
      display: null,
    })
  })

  it('still rejects a filled but invalid number', () => {
    const result = validateOptionalMobileInput('123')
    assert.equal(result.ok, false)
  })

  it('keeps required validation for explicit profile saves', () => {
    assert.equal(validateMobileInput('').ok, false)
    assert.equal(validateMobileInput('+91 98765 43210').ok, true)
  })
})
