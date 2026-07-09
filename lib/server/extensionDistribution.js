import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MANIFEST_PATH = path.join(ROOT, 'extension/manifest.json')

let manifestCache = null

function readManifest() {
  if (manifestCache) return manifestCache
  try {
    manifestCache = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  } catch {
    manifestCache = { version: '1.2.0' }
  }
  return manifestCache
}

/** Semver from extension/manifest.json (single source of truth). */
export function getExtensionManifestVersion() {
  return String(readManifest().version || '1.2.0').trim() || '1.2.0'
}

/** Public Chrome Web Store listing URL — set after first publish. */
export function getChromeWebStoreUrl() {
  const url = String(process.env.CHROME_EXTENSION_STORE_URL || '').trim()
  if (!url) return null
  if (!/^https:\/\/chromewebstore\.google\.com\//i.test(url)) return null
  return url
}

export function getExtensionDistribution() {
  return {
    chromeWebStoreUrl: getChromeWebStoreUrl(),
    extensionVersion: getExtensionManifestVersion(),
    installGuideUrl: 'https://connectintel.net',
    packageScript: 'npm run extension:package',
  }
}
