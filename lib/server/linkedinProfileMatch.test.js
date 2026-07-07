import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  scoreLinkedinProfileMatch,
  pickBestLinkedinMatch,
  linkedinProfileSlug,
} from './linkedinProfileMatch.js'

describe('linkedinProfileMatch', () => {
  it('scores sulaylavsi highly for Sulay Lavsi at Bummer', () => {
    const score = scoreLinkedinProfileMatch('https://www.linkedin.com/in/sulaylavsi', {
      firstName: 'Sulay',
      lastName: 'Lavsi',
      company: 'Bummer',
    })
    assert.ok(score >= 12)
    assert.equal(linkedinProfileSlug('https://www.linkedin.com/in/sulaylavsi'), 'sulaylavsi')
  })

  it('rejects unrelated slug for a named founder', () => {
    const score = scoreLinkedinProfileMatch('https://www.linkedin.com/in/random-marketing-guy', {
      firstName: 'Sulay',
      lastName: 'Lavsi',
      company: 'Bummer',
    })
    assert.ok(score < 12)
  })

  it('picks only matches above minimum score', () => {
    const best = pickBestLinkedinMatch(
      [
        { linkedin: 'https://www.linkedin.com/in/wrong-person', reason: 'Extracted from AI response' },
        {
          linkedin: 'https://www.linkedin.com/in/sulaylavsi',
          reason: 'LinkedIn profile URL from live web search',
        },
      ],
      { firstName: 'Sulay', lastName: 'Lavsi', company: 'Bummer' }
    )
    assert.equal(best?.linkedin, 'https://www.linkedin.com/in/sulaylavsi')
  })

  it('returns null when no match is confident enough', () => {
    const best = pickBestLinkedinMatch(
      [{ linkedin: 'https://www.linkedin.com/in/abc', reason: 'Extracted from AI response' }],
      { firstName: 'Sulay', lastName: 'Lavsi', company: 'Bummer' }
    )
    assert.equal(best, null)
  })
})
