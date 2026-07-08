import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emailPromptBlock, buildCrmDraftOptions } from './crmEmailPrompt.js'

describe('crm email prompt', () => {
  const options = {
    purpose: 'introduction',
    tone: 'professional',
    agenda: 'Introduce our export logistics services and offer a rate comparison',
    keyPoints: '',
    senderName: 'Neeraj Kumar',
    senderCompany: 'Xindus Network Trade Pvt Ltd',
    senderTitle: 'Sales',
  }

  it('marks the location as the recipient, not the sender', () => {
    const lead = { firstName: 'Niketan', company: 'Niketan Export', city: 'Jaipur', state: 'Rajasthan' }
    const prompt = emailPromptBlock(lead, options)
    assert.match(prompt, /Recipient's city\/region: Jaipur, Rajasthan/)
    assert.match(prompt, /NOT the sender's location/i)
  })

  it('forbids fabricating a sender service area from the recipient city', () => {
    const lead = { firstName: 'Niketan', company: 'Niketan Export', city: 'Jaipur', state: 'Rajasthan' }
    const prompt = emailPromptBlock(lead, options)
    assert.match(prompt, /in and around Jaipur, Rajasthan/)
    assert.match(prompt, /never .*in and around/i)
    assert.match(prompt, /Do NOT invent services|Do NOT fabricate/i)
  })

  it('grounds sender claims in the agenda only', () => {
    const lead = { firstName: 'Arthi', company: 'Raguram Exports' }
    const prompt = emailPromptBlock(lead, options)
    assert.match(prompt, /ONLY source of truth/i)
    assert.match(prompt, /Introduce our export logistics services/)
  })

  it('uses the recipient first name in the greeting rule', () => {
    const lead = { firstName: 'Niketan', company: 'Niketan Export' }
    const prompt = emailPromptBlock(lead, options)
    assert.match(prompt, /Hi Niketan,/)
  })

  it('defaults sender company from the user when not supplied', () => {
    const opts = buildCrmDraftOptions(
      { name: 'Neeraj Kumar', organizationName: 'Xindus Network Trade Pvt Ltd' },
      { agenda: 'Follow up on rates' }
    )
    assert.equal(opts.senderCompany, 'Xindus Network Trade Pvt Ltd')
    assert.equal(opts.senderName, 'Neeraj Kumar')
  })
})
