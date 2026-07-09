import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getChromeWebStoreUrl,
  getExtensionManifestVersion,
  getExtensionDistribution,
} from './extensionDistribution.js'

describe('extensionDistribution', () => {
  it('reads extension version from manifest.json', () => {
    const version = getExtensionManifestVersion()
    assert.match(version, /^\d+\.\d+\.\d+$/)
  })

  it('accepts only chromewebstore.google.com URLs', () => {
    const prev = process.env.CHROME_EXTENSION_STORE_URL
    process.env.CHROME_EXTENSION_STORE_URL =
      'https://chromewebstore.google.com/detail/connect-intel/abcdefghij'
    assert.ok(getChromeWebStoreUrl()?.includes('chromewebstore.google.com'))
    process.env.CHROME_EXTENSION_STORE_URL = 'https://evil.example.com/detail/foo'
    assert.equal(getChromeWebStoreUrl(), null)
    if (prev === undefined) delete process.env.CHROME_EXTENSION_STORE_URL
    else process.env.CHROME_EXTENSION_STORE_URL = prev
  })

  it('returns distribution payload shape', () => {
    const dist = getExtensionDistribution()
    assert.equal(typeof dist.extensionVersion, 'string')
    assert.equal(dist.installGuideUrl, 'https://connectintel.net')
  })
})
