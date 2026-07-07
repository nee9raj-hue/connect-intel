import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { captureLeadFromExtension } from './extensionCaptureLead.js'

describe('extensionCaptureLead', () => {
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
