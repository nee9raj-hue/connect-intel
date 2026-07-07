import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  captureLeadFromExtension,
  buildExtensionCaptureMessage,
  buildMissingCapturePatch,
} from './extensionCaptureLead.js'
import { applyCapturePatchToLeadSnapshot } from './pipelineLeadMutations.js'

describe('extensionCaptureLead', () => {
  it('builds patch only for missing pipeline fields', () => {
    const patch = buildMissingCapturePatch(
      {
        firstName: 'Sulay',
        lastName: 'Lavsi',
        company: 'Bummer',
        linkedin: 'https://www.linkedin.com/in/sulaylavsi/',
      },
      {
        firstName: 'Sulay',
        lastName: 'Lavsi',
        company: 'Bummer',
        title: 'Founder',
        email: 'hr@bummer.in',
        phone: '+91-98765-43210',
        city: 'Ahmedabad',
        state: 'Gujarat',
        linkedin: 'https://www.linkedin.com/in/sulaylavsi/',
      }
    )

    assert.deepEqual(patch, {
      title: 'Founder',
      email: 'hr@bummer.in',
      phone: '+91-98765-43210',
      city: 'Ahmedabad',
      state: 'Gujarat',
    })
  })

  it('formats duplicate update message', () => {
    assert.equal(
      buildExtensionCaptureMessage({
        duplicate: true,
        updated: true,
        updatedFields: ['email', 'title'],
      }),
      'Pipeline lead updated with Email, Title'
    )
    assert.equal(
      buildExtensionCaptureMessage({ duplicate: true, updated: false }),
      'Lead already exists — no new fields to add'
    )
  })

  it('patches lead snapshot fields used by pipeline list', () => {
    const entry = {
      lead: { company: 'Unknown Company', firstName: 'Sulay', lastName: 'Lavsi' },
    }
    applyCapturePatchToLeadSnapshot(entry, { company: 'Bummer', city: 'Ahmedabad', state: 'Gujarat' })
    assert.equal(entry.lead.company, 'Bummer')
    assert.equal(entry.lead.city, 'Ahmedabad')
    assert.equal(entry.lead.state, 'Gujarat')
    assert.equal(entry.lead.location, 'Ahmedabad, Gujarat')
  })

  it('rejects empty capture payload', async () => {
    await assert.rejects(
      () => captureLeadFromExtension({ id: 'u1', organizationId: 'org-1' }, {}),
      /company name or contact name/i
    )
  })

  it('rejects capture without contact identifiers', async () => {
    await assert.rejects(
      () =>
        captureLeadFromExtension(
          { id: 'u1', organizationId: 'org-1' },
          { firstName: 'Ada', lastName: 'Lovelace' }
        ),
      /email, phone, LinkedIn/i
    )
  })
})
