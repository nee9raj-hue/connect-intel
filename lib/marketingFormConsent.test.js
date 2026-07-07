import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  submissionGrantsCommercialConsent,
  submissionHasRequiredConsent,
} from './marketingFormSchema.js'

const formWithConsent = {
  fields: [
    { id: 'email', type: 'email', label: 'Email', required: true },
    { id: 'consent', type: 'consent', label: 'I agree', required: true },
  ],
}

describe('form consent submission', () => {
  it('requires checked consent when field is required', () => {
    assert.equal(submissionHasRequiredConsent(formWithConsent, { consent: 'on' }), true)
    assert.equal(submissionHasRequiredConsent(formWithConsent, {}), false)
  })

  it('grants commercial consent only when checkbox is on', () => {
    assert.equal(submissionGrantsCommercialConsent(formWithConsent, { consent: 'on' }), true)
    assert.equal(submissionGrantsCommercialConsent(formWithConsent, {}), false)
    assert.equal(submissionGrantsCommercialConsent({ fields: [{ id: 'email', type: 'email' }] }, {}), true)
  })
})
