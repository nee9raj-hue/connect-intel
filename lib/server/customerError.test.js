import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  customerSafeErrorMessage,
  customerSignInBusyMessage,
  customerWorkspaceBusyMessage,
} from './customerError.js'

describe('customerSafeErrorMessage', () => {
  it('hides Supabase / Vercel / env-var details', () => {
    const leaked =
      'Database unavailable (Supabase request timed out). Sign-in needs Supabase. In Vercel: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'
    const safe = customerSafeErrorMessage(leaked)
    assert.equal(safe, customerWorkspaceBusyMessage())
    assert.equal(/supabase|vercel|SUPABASE_/i.test(safe), false)
  })

  it('uses sign-in fallback when asked', () => {
    assert.equal(
      customerSafeErrorMessage(new Error('circuit open'), customerSignInBusyMessage()),
      customerSignInBusyMessage()
    )
  })

  it('keeps a normal product error', () => {
    assert.equal(customerSafeErrorMessage(new Error('Invalid password')), 'Invalid password')
  })
})
