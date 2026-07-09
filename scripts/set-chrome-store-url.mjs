#!/usr/bin/env node
/**
 * Set CHROME_EXTENSION_STORE_URL on Vercel Production and redeploy.
 * Usage: node scripts/set-chrome-store-url.mjs https://chromewebstore.google.com/detail/connect-intel/XXXXXXXX
 */
import { execSync } from 'node:child_process'

const url = String(process.argv[2] || '').trim()
if (!/^https:\/\/chromewebstore\.google\.com\//i.test(url)) {
  console.error('Usage: node scripts/set-chrome-store-url.mjs <chromewebstore-url>')
  process.exit(1)
}

console.log('Setting CHROME_EXTENSION_STORE_URL on Vercel Production…')
execSync(`printf '%s' '${url.replace(/'/g, "'\\''")}' | vercel env add CHROME_EXTENSION_STORE_URL production`, {
  stdio: 'inherit',
})
console.log('Done. Redeploy production (git push or vercel --prod) for Team → Integrations install button.')
