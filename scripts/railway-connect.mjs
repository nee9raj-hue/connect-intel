#!/usr/bin/env node
/**
 * Connect Connect Intel email worker to Railway.
 *
 * Prerequisites:
 *   railway login          (or RAILWAY_API_TOKEN / RAILWAY_TOKEN)
 *   vercel login           (pulls REDIS_URL; sensitive vars need .env.railway.secrets)
 *
 * Usage:
 *   npm run railway:connect
 *   npm run railway:connect -- --skip-deploy
 *
 * Sensitive Vercel vars (Supabase key, Gmail, etc.) cannot be exported via CLI.
 * Copy them once into .env.railway.secrets (gitignored) or paste when prompted.
 */

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = 'nee9raj-hue/connect-intel'
const PROJECT_NAME = 'connect-intel-workers'
const SERVICE_NAME = 'email-worker'
const SECRETS_FILE = join(ROOT, '.env.railway.secrets')
const SECRETS_EXAMPLE = join(ROOT, '.env.railway.secrets.example')

const WORKER_ENV_KEYS = [
  'REDIS_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'SESSION_SECRET',
  'APP_URL',
  'INVITE_EMAIL_PROVIDER',
  'GEMINI_API_KEY',
  'CRM_INBOUND_EMAIL_DOMAIN',
  'CRM_INBOUND_FORWARD_FROM',
  'CRON_SECRET',
  'USE_PIPELINE_LEADS_TABLE',
  'EMAIL_WORKER_CONCURRENCY',
  'WORKER_CONCURRENCY',
]

const ENV_FALLBACKS = {
  SUPABASE_URL: 'https://hkdrannqcnszfukcqchj.supabase.co',
  APP_URL: 'https://connectintel.net',
  EMAIL_FROM: 'Connect Intel <invite@connectintel.net>',
  INVITE_EMAIL_PROVIDER: 'resend',
  USE_PIPELINE_LEADS_TABLE: 'true',
  EMAIL_WORKER_CONCURRENCY: '2',
}

const REQUIRED_FOR_WORKER = [
  'REDIS_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'EMAIL_FROM',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
]

const skipDeploy = process.argv.includes('--skip-deploy')

function run(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: opts.silent ? 'pipe' : 'inherit',
    ...opts,
  })
}

function runJson(cmd) {
  const out = run(cmd, { silent: true })
  const trimmed = String(out || '').trim()
  if (!trimmed) return null
  return JSON.parse(trimmed)
}

function railway(args, { json = false } = {}) {
  const cmd = `npx @railway/cli ${args}${json && !args.includes('--json') ? ' --json' : ''}`
  if (json) return runJson(cmd)
  run(cmd)
  return null
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const text = readFileSync(path, 'utf8')
  const vars = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (value) vars[key] = value
  }
  return vars
}

function mergeEnv(...sources) {
  return Object.assign({}, ...sources)
}

function ensureRailwayAuth() {
  try {
    const who = run('npx @railway/cli whoami', { silent: true }).trim()
    console.log(`Railway: ${who}`)
    return
  } catch {
    console.error(`
Not logged in to Railway. Run: npx @railway/cli login
`)
    process.exit(1)
  }
}

function pullVercelEnv() {
  const envPath = join(ROOT, '.env.railway.sync')
  if (existsSync(envPath)) unlinkSync(envPath)
  console.log('Pulling Vercel production env (non-sensitive only)...')
  run(`vercel env pull "${envPath}" --environment=production --yes`)
  const pulled = parseEnvFile(envPath)
  unlinkSync(envPath)

  const localSecrets = parseEnvFile(SECRETS_FILE)
  const deployLocal = parseEnvFile(join(ROOT, '.env.deploy.local'))
  const envLocal = parseEnvFile(join(ROOT, '.env.local'))

  return mergeEnv(ENV_FALLBACKS, deployLocal, envLocal, pulled, localSecrets)
}

function ensureSecretsExample() {
  if (existsSync(SECRETS_EXAMPLE)) return
  writeFileSync(
    SECRETS_EXAMPLE,
    `# Copy to .env.railway.secrets and fill from Supabase + Google Cloud consoles.
# Vercel "Sensitive" vars cannot be re-exported via CLI.

SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
CRON_SECRET=
`
  )
}

async function promptMissingSecrets(vars) {
  const missing = REQUIRED_FOR_WORKER.filter((k) => !vars[k])
  if (!missing.length) return vars

  if (!process.stdin.isTTY) {
    return vars
  }

  console.log('\nMissing secrets (Vercel hides sensitive values). Paste each or press Enter to skip:\n')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const ask = (key) =>
    new Promise((resolve) => {
      rl.question(`${key}: `, (answer) => resolve(answer.trim()))
    })

  for (const key of missing) {
    const value = await ask(key)
    if (value) vars[key] = value
  }
  rl.close()

  const stillMissing = REQUIRED_FOR_WORKER.filter((k) => !vars[k])
  if (stillMissing.length) {
    console.log(`\nStill missing: ${stillMissing.join(', ')}`)
    console.log(`Create ${SECRETS_FILE} from .env.railway.secrets.example and re-run.`)
  }

  return vars
}

function isProjectLinked() {
  try {
    const status = railway('status --json', { json: true })
    return Boolean(status?.id)
  } catch {
    return false
  }
}

function ensureServiceExists() {
  try {
    const status = railway('status --json', { json: true })
    const services = status?.services?.edges || []
    if (services.length > 0) {
      console.log(`Railway service: ${services[0]?.node?.name || 'linked'}`)
      railway(`service link ${SERVICE_NAME}`)
      return
    }
  } catch {
    /* create below */
  }
  console.log(`Creating Railway service "${SERVICE_NAME}" from GitHub...`)
  railway(
    `add --repo ${REPO} --branch main --service ${SERVICE_NAME} --json`,
    { json: true }
  )
  railway(`service link ${SERVICE_NAME}`)
}

function ensureProjectLinked() {
  if (isProjectLinked()) {
    console.log('Railway project already linked')
    ensureServiceExists()
    return
  }
  console.log(`Creating Railway project "${PROJECT_NAME}"...`)
  railway(`init --name "${PROJECT_NAME}" --json`, { json: true })
  ensureServiceExists()
}

function setRailwayVar(key, value) {
  const result = spawnSync(
    'npx',
    ['@railway/cli', 'variable', 'set', key, '--stdin', '--skip-deploys', '-s', SERVICE_NAME],
    {
      cwd: ROOT,
      input: value,
      encoding: 'utf8',
      stdio: ['pipe', 'inherit', 'inherit'],
    }
  )
  if (result.status !== 0) {
    throw new Error(`Failed to set ${key}`)
  }
}

function setWorkerVariables(vars) {
  const toSet = {}
  for (const key of WORKER_ENV_KEYS) {
    if (vars[key]) toSet[key] = vars[key]
  }

  const missing = REQUIRED_FOR_WORKER.filter((k) => !toSet[k])
  if (missing.length) {
    console.warn(`\nWarning: worker may not send email until these are set: ${missing.join(', ')}`)
  }

  if (!Object.keys(toSet).length) {
    console.error('No variables to set on Railway.')
    process.exit(1)
  }

  console.log(`Setting ${Object.keys(toSet).length} Railway variables...`)
  for (const [key, value] of Object.entries(toSet)) {
    setRailwayVar(key, value)
  }
}

function connectGitHub() {
  console.log(`Connecting GitHub repo ${REPO} (main)...`)
  try {
    railway(`service source connect --repo ${REPO} --branch main --service ${SERVICE_NAME}`)
  } catch {
    try {
      railway(`service source connect --repo ${REPO} --branch main`)
    } catch {
      console.warn('GitHub connect skipped — link repo in Railway dashboard if needed.')
    }
  }
}

function deploy() {
  if (skipDeploy) {
    console.log('Skipping deploy. Run: npx @railway/cli up -y -d')
    return
  }
  console.log('Deploying worker (railway up)...')
  railway('up -y -d')
}

async function verifyProduction() {
  console.log('\nWaiting 60s for worker heartbeat...')
  await new Promise((r) => setTimeout(r, 60_000))
  try {
    const health = run('curl -sS -m 20 https://connectintel.net/api/health', { silent: true })
    const json = JSON.parse(health)
    const worker = json.worker || {}
    const emailV3 = json.emailV3 || {}
    console.log('\nProduction health:')
    console.log(`  worker.ok: ${worker.ok}`)
    console.log(`  emailV3.ready: ${emailV3.ready}`)
    console.log(`  emailQueueBacklog: ${worker.emailQueueBacklog ?? '?'}`)
    if (!worker.ok) {
      console.log('\nCheck logs: npx @railway/cli logs')
    }
  } catch (err) {
    console.warn('Could not verify /api/health:', err?.message || err)
  }
}

async function main() {
  console.log('Connect Intel — Railway worker connect\n')
  ensureSecretsExample()
  ensureRailwayAuth()
  let vars = pullVercelEnv()
  ensureProjectLinked()
  vars = await promptMissingSecrets(vars)
  setWorkerVariables(vars)
  connectGitHub()
  deploy()
  await verifyProduction()
  console.log('\nDone. Docs: docs/RAILWAY_WORKER.md')
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
