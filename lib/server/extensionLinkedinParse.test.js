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
  companyFromExperienceLines,
  isHeadlineJunkCompany,
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

  it('uses the Experience company over a junk headline', () => {
    const company = pickCompanyName({
      topCardCompany: '',
      buttonCompany: '',
      experienceCompany: 'Ariro Toys',
      experienceLinkCompany: '',
      headlineCompany: "India's No.1 Montessori Toy Brand",
    })
    assert.equal(company, 'Ariro Toys')
  })

  it('prefers the top-card company above all', () => {
    const company = pickCompanyName({
      topCardCompany: 'Ariro Toys',
      buttonCompany: '',
      experienceCompany: 'Innovasia Media',
      experienceLinkCompany: '',
      headlineCompany: '',
    })
    assert.equal(company, 'Ariro Toys')
  })

  it('returns empty rather than a junk headline company', () => {
    const company = pickCompanyName({
      topCardCompany: '',
      buttonCompany: '',
      experienceCompany: '',
      experienceLinkCompany: '',
      headlineCompany: "India's No.1 Montessori Toy Brand",
    })
    assert.equal(company, '')
  })

  it('never captures a company the person merely follows (no page-wide source)', () => {
    // "Skillmatics" is only ever a page-wide/interests link, which is no longer
    // an input to resolution, so it can never be selected.
    const company = pickCompanyName({
      topCardCompany: '',
      buttonCompany: '',
      experienceCompany: 'Ariro Toys',
      experienceLinkCompany: '',
      headlineCompany: '',
    })
    assert.equal(company, 'Ariro Toys')
  })

  it('extracts company from Experience item lines, skipping dates/type', () => {
    const lines = [
      'Founder',
      'Ariro toys · Full-time',
      'Jun 2020 - Present · 6 yrs 2 mos',
      'Chennai, Tamil Nadu, India',
    ]
    assert.equal(companyFromExperienceLines(lines), 'Ariro toys')
  })

  it('keeps a legitimate company with an apostrophe from a reliable source', () => {
    const company = pickCompanyName({ experienceCompany: "Domino's Pizza" })
    assert.equal(company, "Domino's Pizza")
    assert.equal(isHeadlineJunkCompany("Domino's Pizza"), true)
  })
})
