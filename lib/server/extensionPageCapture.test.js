import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const parsePath = new URL('../../extension/lib/linkedinCaptureParse.js', import.meta.url)
const pagePath = new URL('../../extension/lib/pageCapture.js', import.meta.url)

function loadPageCapture(dom = {}) {
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
      href: 'https://www.linkedin.com/in/sulaylavsi/',
      hostname: 'www.linkedin.com',
      ...dom.location,
    },
    window: {},
  }
  sandbox.window = sandbox
  sandbox.globalThis = sandbox.globalThis

  const parseCode = fs.readFileSync(parsePath, 'utf8')
  const pageCode = fs.readFileSync(pagePath, 'utf8')
  vm.runInNewContext(`${parseCode}\n${pageCode}`, sandbox)
  return sandbox.globalThis.__connectIntelExtractPage
}

describe('extension page capture', () => {
  it('extracts LinkedIn profile from document title without throwing', () => {
    const extract = loadPageCapture({
      document: { title: 'Sulay Lavsi | LinkedIn' },
    })
    const capture = extract()
    assert.ok(capture)
    assert.equal(capture.pageType, 'linkedin_profile')
    assert.equal(capture.firstName, 'Sulay')
    assert.equal(capture.lastName, 'Lavsi')
    assert.match(capture.linkedin, /sulaylavsi/i)
  })

  it('parses headline company from title segment', () => {
    const extract = loadPageCapture({
      document: {
        title: 'Sulay Lavsi - Founder - Bummer | Forbes30U30 | LinkedIn',
        querySelector(sel) {
          if (sel === 'main') return null
          if (String(sel).includes('text-body-medium')) {
            return { textContent: 'Founder - Bummer | Forbes30U30 | D2C Consultant' }
          }
          return null
        },
      },
    })
    const capture = extract()
    assert.equal(capture.company, 'Bummer')
    assert.match(capture.title, /Founder/i)
  })
})
