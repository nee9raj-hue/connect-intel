import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const parsePath = new URL('../../extension/lib/linkedinCaptureParse.js', import.meta.url)
const contactPath = new URL('../../extension/lib/contactPageParse.js', import.meta.url)
const pagePath = new URL('../../extension/lib/pageCapture.js', import.meta.url)

function loadCapture(dom = {}) {
  const sandbox = {
    globalThis: {},
    document: {
      title: '',
      querySelector: () => null,
      querySelectorAll: () => [],
      body: { innerText: '' },
      ...dom.document,
    },
    location: {
      href: 'https://acme.example/team/jane-doe',
      hostname: 'acme.example',
      ...dom.location,
    },
    window: {},
  }
  sandbox.window = sandbox
  sandbox.globalThis = sandbox.globalThis

  const code = [
    fs.readFileSync(parsePath, 'utf8'),
    fs.readFileSync(contactPath, 'utf8'),
    fs.readFileSync(pagePath, 'utf8'),
  ].join('\n')
  vm.runInNewContext(code, sandbox)
  return {
    extract: sandbox.globalThis.__connectIntelExtractPage,
    contact: sandbox.globalThis.__connectIntelContactPageParse,
  }
}

describe('extension contact page capture', () => {
  it('extracts person from schema.org JSON-LD', () => {
    const jsonLd = JSON.stringify({
      '@type': 'Person',
      name: 'Jane Doe',
      jobTitle: 'Head of Sales',
      worksFor: { '@type': 'Organization', name: 'Acme Corp' },
      email: 'jane@acme.example',
      telephone: '+91-98765-43210',
    })
    const { extract } = loadCapture({
      document: {
        title: 'Jane Doe | Acme Corp',
        querySelector(sel) {
          if (String(sel).includes('application/ld+json')) {
            return { textContent: jsonLd }
          }
          return null
        },
        querySelectorAll(sel) {
          if (String(sel).includes('application/ld+json')) {
            return [{ textContent: jsonLd }]
          }
          return []
        },
      },
    })
    const capture = extract()
    assert.equal(capture.pageType, 'contact_page')
    assert.equal(capture.firstName, 'Jane')
    assert.equal(capture.lastName, 'Doe')
    assert.equal(capture.company, 'Acme Corp')
    assert.equal(capture.email, 'jane@acme.example')
    assert.match(capture.phone || '', /98765/)
  })

  it('extracts mailto and heading from team page', () => {
    const { extract } = loadCapture({
      document: {
        title: 'Rahul Sharma - Founder | Bright Foods',
        body: { innerText: 'Reach us at rahul@brightfoods.in or call +91-91234-56789' },
        querySelector(sel) {
          if (sel === 'h1') return { textContent: 'Rahul Sharma' }
          if (String(sel).startsWith('a[href^="mailto:"]')) {
            return { getAttribute: () => 'mailto:rahul@brightfoods.in' }
          }
          return null
        },
        querySelectorAll(sel) {
          if (String(sel).startsWith('a[href^="mailto:"]')) {
            return [
              {
                getAttribute: (name) =>
                  name === 'href' ? 'mailto:rahul@brightfoods.in' : '',
              },
            ]
          }
          if (String(sel).startsWith('a[href^="tel:"]')) return []
          if (String(sel).includes('application/ld+json')) return []
          if (String(sel).includes('linkedin.com')) return []
          return []
        },
      },
    })
    const capture = extract()
    assert.equal(capture.firstName, 'Rahul')
    assert.equal(capture.lastName, 'Sharma')
    assert.equal(capture.email, 'rahul@brightfoods.in')
    assert.ok(capture.phone || capture.company)
  })

  it('quickContactSignals detects mailto links', () => {
    const { contact } = loadCapture({
      document: {
        querySelector(sel) {
          if (String(sel).startsWith('a[href^="mailto:"]')) return {}
          return null
        },
        querySelectorAll: () => [],
      },
    })
    assert.equal(contact.quickContactSignals(), true)
  })

  it('extracts multiple people from team page JSON-LD graph', () => {
    const graph = [
      {
        '@type': 'Person',
        name: 'Jane Doe',
        email: 'jane@acme.example',
        jobTitle: 'CEO',
        worksFor: { name: 'Acme Corp' },
      },
      {
        '@type': 'Person',
        name: 'John Smith',
        email: 'john@acme.example',
        jobTitle: 'CTO',
        worksFor: { name: 'Acme Corp' },
      },
    ]
    const jsonLd = JSON.stringify({ '@graph': graph })
    const { contact } = loadCapture({
      document: {
        title: 'Team | Acme Corp',
        querySelector(sel) {
          if (String(sel).includes('application/ld+json')) {
            return { textContent: jsonLd }
          }
          return null
        },
        querySelectorAll(sel) {
          if (String(sel).includes('application/ld+json')) {
            return [{ textContent: jsonLd }]
          }
          return []
        },
      },
      location: {
        href: 'https://acme.example/team',
        hostname: 'acme.example',
      },
    })
    const candidates = contact.extractContactCandidates()
    assert.equal(candidates.length, 2)
    assert.equal(candidates[0].email, 'jane@acme.example')
    assert.equal(candidates[1].email, 'john@acme.example')
  })

  it('dedupes candidates by email fingerprint', () => {
    const { contact } = loadCapture({})
    const deduped = contact.dedupeCandidates([
      { firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.example' },
      { firstName: 'Jane', lastName: 'D', email: 'jane@acme.example' },
      { firstName: 'John', lastName: 'Smith', email: 'john@acme.example' },
    ])
    assert.equal(deduped.length, 2)
  })

  it('extracts CRM/ERP label-value fields (Xindus customer page)', () => {
    const bodyText = `
Company Info
Contact Name
DIWAKAR KUMAR
Contact No
8882182904
Contact Email
MVI2K21@GMAIL.COM
Trade Name
MULTI VISION INC.
IEC Number
BRQPK4603M
GST Number
09BRQPK4603M1Z9
Pan Number
BRQPK4603M
Constitution of Business
Proprietorship
Category of exporters
Merchant Exporter
Firm mobile no
8882182904
Firm email id
2kumardiwakar@gmail.com
Account Details
`
    const { extract } = loadCapture({
      document: {
        title: 'Xindus ERP',
        body: { innerText: bodyText },
        querySelector(sel) {
          if (sel === 'h1') return { textContent: 'Manage MULTI VISION INC' }
          return null
        },
        querySelectorAll: () => [],
      },
      location: {
        href: 'https://one.xindus.net/customer/edit?userId=699',
        hostname: 'one.xindus.net',
      },
    })
    const capture = extract()
    assert.equal(capture.pageType, 'crm_form')
    assert.equal(capture.firstName, 'DIWAKAR')
    assert.equal(capture.lastName, 'KUMAR')
    assert.equal(capture.company, 'MULTI VISION INC.')
    assert.equal(capture.email, 'mvi2k21@gmail.com')
    assert.match(capture.phone || '', /88821/)
    assert.ok(!capture.title)
    assert.match(capture.notes || '', /GST:/)
    assert.match(capture.notes || '', /IEC:/)
  })
})
