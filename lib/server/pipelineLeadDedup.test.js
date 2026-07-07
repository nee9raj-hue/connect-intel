import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeLinkedinKey,
  normalizeCompanyKey,
  pipelineEntryMatchesIdentity,
  findExistingPipelineEntry,
} from './pipelineLeadDedup.js'

const user = { id: 'user-1' }
const organizationId = 'org-1'

function makeEntry(overrides = {}) {
  const { lead: leadOverrides = {}, ...rest } = overrides
  return {
    id: 'saved-1',
    userId: 'user-1',
    organizationId: 'org-1',
    contactId: 'lead-1',
    lead: {
      id: 'lead-1',
      firstName: 'Sulay',
      lastName: 'Lavsi',
      company: 'Bummer',
      linkedin: 'https://www.linkedin.com/in/sulaylavsi/',
      email: '',
      phone: '',
      ...leadOverrides,
    },
    ...rest,
  }
}

describe('pipelineLeadDedup', () => {
  it('normalizes LinkedIn URLs for comparison', () => {
    assert.equal(
      normalizeLinkedinKey('https://www.linkedin.com/in/sulaylavsi/'),
      'sulaylavsi'
    )
    assert.equal(
      normalizeLinkedinKey('linkedin.com/in/sulaylavsi'),
      'sulaylavsi'
    )
  })

  it('matches duplicate extension capture by LinkedIn', () => {
    const entry = makeEntry()
    assert.equal(
      pipelineEntryMatchesIdentity(
        entry,
        {
          firstName: 'Sulay',
          lastName: 'Lavsi',
          company: 'Bummer',
          linkedin: 'https://linkedin.com/in/sulaylavsi',
        },
        { user, organizationId }
      ),
      true
    )
  })

  it('matches duplicate by name and company when LinkedIn missing', () => {
    const entry = makeEntry({ lead: { linkedin: '' } })
    assert.equal(
      pipelineEntryMatchesIdentity(
        entry,
        { firstName: 'Sulay', lastName: 'Lavsi', company: 'Bummer Pvt Ltd' },
        { user, organizationId }
      ),
      true
    )
  })

  it('does not match different people at same company', () => {
    const entry = makeEntry()
    assert.equal(
      pipelineEntryMatchesIdentity(
        entry,
        { firstName: 'Other', lastName: 'Person', company: 'Bummer' },
        { user, organizationId }
      ),
      false
    )
  })

  it('findExistingPipelineEntry returns first workspace match', () => {
    const store = {
      savedLeads: [
        makeEntry(),
        makeEntry({
          id: 'saved-2',
          contactId: 'lead-2',
          lead: { id: 'lead-2', firstName: 'Ada', lastName: 'Lovelace', company: 'Analytical' },
        }),
      ],
    }

    const found = findExistingPipelineEntry(
      store,
      user,
      {
        firstName: 'Sulay',
        lastName: 'Lavsi',
        company: 'Bummer',
        linkedin: 'https://www.linkedin.com/in/sulaylavsi/',
      },
      { organizationId }
    )

    assert.equal(found?.contactId, 'lead-1')
  })

  it('ignores leads outside workspace', () => {
    const entry = makeEntry({ organizationId: 'other-org' })
    assert.equal(
      pipelineEntryMatchesIdentity(
        entry,
        { firstName: 'Sulay', lastName: 'Lavsi', company: 'Bummer' },
        { user, organizationId }
      ),
      false
    )
  })

  it('normalizes company suffixes', () => {
    assert.equal(normalizeCompanyKey('Bummer Pvt Ltd'), normalizeCompanyKey('Bummer'))
  })
})
