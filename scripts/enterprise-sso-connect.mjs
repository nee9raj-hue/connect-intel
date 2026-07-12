#!/usr/bin/env node
/**
 * Wire enterprise SSO (Azure AD or Okta) on Vercel production.
 *
 * Usage:
 *   npm run sso:connect -- --provider azure-ad \
 *     --tenant-id <tenant> --client-id <id> --client-secret <secret>
 *
 *   npm run sso:connect -- --provider okta \
 *     --domain dev-123.okta.com --client-id <id> --client-secret <secret>
 *
 * Loads from .env.enterprise-sso.local when flags omitted (gitignored).
 * Verifies https://connectintel.net/api/public-config after deploy.
 */

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRODUCTION_URL = 'https://connectintel.net'
const REDIRECT_URI = `${PRODUCTION_URL}/api/auth/sso/callback`

function parseArgs(argv) {
  const out = { provider: 'azure-ad', dryRun: false, skipDeploy: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--provider') out.provider = String(argv[++i] || '').toLowerCase()
    else if (a === '--tenant-id') out.tenantId = argv[++i]
    else if (a === '--client-id') out.clientId = argv[++i]
    else if (a === '--client-secret') out.clientSecret = argv[++i]
    else if (a === '--domain') out.oktaDomain = argv[++i]
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--skip-deploy') out.skipDeploy = true
  }
  return out
}

function loadLocalEnv() {
  const path = join(ROOT, '.env.enterprise-sso.local')
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[trimmed.slice(0, eq).trim()] = v
  }
  return env
}

function vercelEnvAdd(key, value) {
  const escaped = String(value).replace(/'/g, "'\\''")
  const res = spawnSync('sh', ['-c', `printf '%s' '${escaped}' | vercel env add ${key} production`], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim()
    if (/already exists/i.test(err)) {
      spawnSync('sh', ['-c', `printf '%s' '${escaped}' | vercel env rm ${key} production -y`], { cwd: ROOT, stdio: 'inherit' })
      return vercelEnvAdd(key, value)
    }
    throw new Error(`vercel env add ${key} failed: ${err}`)
  }
}

async function verifyPublicConfig(provider) {
  const res = await fetch(`${PRODUCTION_URL}/api/public-config`, { signal: AbortSignal.timeout(20_000) })
  const data = await res.json()
  const entry = (data?.auth?.enterprise || []).find((e) => e.id === provider)
  return { ok: Boolean(entry?.configured && entry?.startUrl), entry, auth: data?.auth }
}

function printAzurePortalSteps() {
  console.log(`
Azure Portal — one-time app registration (if you do not have client id/secret yet):

  1. Open https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade
  2. Name: Connect Intel Production SSO
  3. Supported account types: single tenant (or per customer policy)
  4. Redirect URI — Web: ${REDIRECT_URI}
  5. After create → Certificates & secrets → New client secret
  6. Copy Application (client) ID, Directory (tenant) ID, and secret value

Then run:
  npm run sso:connect -- --provider azure-ad \\
    --tenant-id <tenant-id> --client-id <client-id> --client-secret <secret>
`)
}

async function main() {
  const local = loadLocalEnv()
  const args = parseArgs(process.argv.slice(2))
  const provider = args.provider || local.AUTH_PROVIDER || 'azure-ad'

  const tenantId = args.tenantId || local.AZURE_AD_TENANT_ID
  const clientId = args.clientId || local.AZURE_AD_CLIENT_ID || local.OKTA_CLIENT_ID
  const clientSecret = args.clientSecret || local.AZURE_AD_CLIENT_SECRET || local.OKTA_CLIENT_SECRET
  const oktaDomain = args.oktaDomain || local.OKTA_DOMAIN

  console.log('Connect Intel — enterprise SSO → Vercel production\n')
  console.log('Provider:', provider)
  console.log('Redirect URI (register in IdP):', REDIRECT_URI)

  if (provider === 'azure-ad' && (!tenantId || !clientId || !clientSecret)) {
    printAzurePortalSteps()
    console.error('Missing AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, or AZURE_AD_CLIENT_SECRET.')
    console.error('Pass flags or create .env.enterprise-sso.local (see .env.enterprise-sso.example).')
    process.exit(1)
  }

  if (provider === 'okta' && (!oktaDomain || !clientId || !clientSecret)) {
    console.error('Missing OKTA_DOMAIN, OKTA_CLIENT_ID, or OKTA_CLIENT_SECRET.')
    process.exit(1)
  }

  const envPairs =
    provider === 'okta'
      ? {
          AUTH_PROVIDER: 'okta',
          OKTA_DOMAIN: oktaDomain,
          OKTA_CLIENT_ID: clientId,
          OKTA_CLIENT_SECRET: clientSecret,
        }
      : {
          AUTH_PROVIDER: 'azure-ad',
          AZURE_AD_TENANT_ID: tenantId,
          AZURE_AD_CLIENT_ID: clientId,
          AZURE_AD_CLIENT_SECRET: clientSecret,
        }

  if (args.dryRun) {
    console.log('\nDry run — would set on Vercel production:')
    for (const [k, v] of Object.entries(envPairs)) {
      console.log(`  ${k}=${k.includes('SECRET') ? '***' : v}`)
    }
    return
  }

  console.log('\nSetting Vercel production env…')
  for (const [key, value] of Object.entries(envPairs)) {
    vercelEnvAdd(key, value)
    console.log(`  ✓ ${key}`)
  }

  if (!args.skipDeploy) {
    console.log('\nRedeploying production (required for new env vars)…')
    execSync('vercel deploy --prod --yes', { cwd: ROOT, stdio: 'inherit' })
  } else {
    console.log('\nSkipped deploy (--skip-deploy). Redeploy from Vercel dashboard or push to main.')
  }

  console.log('\nVerifying public-config…')
  await new Promise((r) => setTimeout(r, 15_000))
  const check = await verifyPublicConfig(provider)
  if (check.ok) {
    console.log(`✓ Enterprise SSO live: ${check.entry.startUrl}`)
    console.log('\nSign in at https://connectintel.net → Sign in → Microsoft/Okta button should appear.')
  } else {
    console.warn('⚠ public-config not yet showing configured=true — wait for deploy or run npm run prod:log')
    console.log(JSON.stringify(check.entry, null, 2))
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
