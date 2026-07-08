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
  isLikelyLocationText,
  pickCompanyName,
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

  it('does not treat a marketing headline as a location', () => {
    const headline = "Crafting Ariro Toys - India's No.1 Montessori Toy Brand"
    assert.equal(isLikelyLocationText(headline), false)
    assert.equal(isLikelyLocationText(headline, [headline]), false)
  })

  it('accepts real locations', () => {
    assert.equal(isLikelyLocationText('Chennai, Tamil Nadu, India'), true)
    assert.equal(isLikelyLocationText('Greater Ahmedabad Area'), true)
    assert.equal(isLikelyLocationText('Tamil Nadu'), true)
  })

  it('excludes the headline/name/company from location candidates', () => {
    assert.equal(isLikelyLocationText('Ariro Toys', ['Ariro Toys']), false)
    assert.equal(isLikelyLocationText('Vasanth Tamilselvan', ['Vasanth Tamilselvan']), false)
  })

  it('prefers the Experience/current company over a sidebar link', () => {
    const company = pickCompanyName({
      topCardCompany: '',
      buttonCompany: '',
      experienceCompany: 'Ariro Toys',
      linkCompany: 'Skillmatics',
      headlineCompany: "India's No.1 Montessori Toy Brand",
    })
    assert.equal(company, 'Ariro Toys')
  })

  it('prefers the top-card company above all', () => {
    const company = pickCompanyName({
      topCardCompany: 'Ariro Toys',
      buttonCompany: '',
      experienceCompany: 'Innovasia Media',
      linkCompany: 'Skillmatics',
      headlineCompany: '',
    })
    assert.equal(company, 'Ariro Toys')
  })
})
