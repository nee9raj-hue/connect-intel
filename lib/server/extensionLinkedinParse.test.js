import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const parsePath = new URL('../../extension/lib/linkedinCaptureParse.js', import.meta.url)

// Load classic script exports via vm-style eval
const fs = await import('node:fs')
const vm = await import('node:vm')
const code = fs.readFileSync(parsePath, 'utf8')
const sandbox = { globalThis: {} }
vm.runInNewContext(`${code}\nglobalThis.__connectIntelLinkedInParse`, sandbox)
const {
  parseHeadline,
  parseLocationToCityState,
  findEmailInText,
  findPhoneInText,
} = sandbox.globalThis.__connectIntelLinkedInParse

describe('extension LinkedIn parse helpers', () => {
  it('parses Founder - Bummer headline', () => {
    const { title, company } = parseHeadline('Founder - Bummer | Forbes30U30 | D2C Consultant')
    assert.match(title, /Founder/i)
    assert.equal(company, 'Bummer')
  })

  it('parses Greater Ahmedabad Area location', () => {
    const loc = parseLocationToCityState('Greater Ahmedabad Area')
    assert.equal(loc.city, 'Ahmedabad')
  })

  it('finds email and Indian phone in text', () => {
    assert.equal(findEmailInText('reach sulay@bummer.in today'), 'sulay@bummer.in')
    assert.match(findPhoneInText('call +91 98765 43210'), /\+91/)
  })
})
