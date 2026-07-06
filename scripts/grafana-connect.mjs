#!/usr/bin/env node
/**
 * Wire Grafana Cloud + Railway Alloy scraper for Connect Intel metrics.
 *
 *   npm run grafana:connect
 *   npm run grafana:connect -- --skip-deploy
 *
 * Secrets: .env.grafana.secrets (copy from .env.grafana.secrets.example)
 * Also uses CRON_SECRET from .env.deploy.local for METRICS_SECRET sync.
 */

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SECRETS_FILE = join(ROOT, '.env.grafana.secrets')
const SECRETS_EXAMPLE = join(ROOT, '.env.grafana.secrets.example')
const DEPLOY_LOCAL = join(ROOT, '.env.deploy.local')
const SERVICE_NAME = 'grafana-alloy'
const PRODUCTION = 'https://connectintel.net'
const DASHBOARD_PATH = join(ROOT, 'infra/grafana/dashboard-connectintel.json')
const skipDeploy = process.argv.includes('--skip-deploy')

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts })
}

function runJson(cmd) {
  const out = run(cmd, { silent: true })
  const trimmed = String(out || '').trim()
  return trimmed ? JSON.parse(trimmed) : null
}

function railway(args, { json = false } = {}) {
  const cmd = `npx @railway/cli ${args}${json && !args.includes('--json') ? ' --json' : ''}`
  if (json) return runJson(cmd)
  run(cmd)
  return null
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const vars = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
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

function ensureSecretsExample() {
  if (existsSync(SECRETS_EXAMPLE)) return
  writeFileSync(
    SECRETS_EXAMPLE,
    `# Copy to .env.grafana.secrets — Grafana Cloud → stack → Prometheus → Details
# Create token: Grafana Cloud → Administration → Cloud access policies → metrics:write

GRAFANA_CLOUD_PROMETHEUS_URL=
GRAFANA_CLOUD_PROMETHEUS_USERNAME=
GRAFANA_CLOUD_PROMETHEUS_PASSWORD=
GRAFANA_CLOUD_API_KEY=
GRAFANA_CLOUD_STACK_SLUG=
`
  )
}

function upsertDeployLocalLine(key, value) {
  let text = existsSync(DEPLOY_LOCAL) ? readFileSync(DEPLOY_LOCAL, 'utf8') : ''
  const line = `${key}=${value}`
  if (new RegExp(`^${key}=`, 'm').test(text)) {
    text = text.replace(new RegExp(`^${key}=.*$`, 'm'), line)
  } else {
    text = `${text.trimEnd()}\n${line}\n`
  }
  writeFileSync(DEPLOY_LOCAL, text)
}

function syncMetricsSecretToVercel(metricsSecret) {
  console.log('Syncing METRICS_SECRET on Vercel production…')
  try {
    run('vercel env rm METRICS_SECRET production --yes', { silent: true })
  } catch {
    /* may not exist */
  }
  spawnSync('sh', ['-c', `printf '%s' '${metricsSecret.replace(/'/g, "'\\''")}' | vercel env add METRICS_SECRET production`], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  upsertDeployLocalLine('METRICS_SECRET', metricsSecret)
  console.log('✓ METRICS_SECRET synced to Vercel + .env.deploy.local')
}

async function verifyMetricsScrape(secret) {
  const url = `${PRODUCTION}/api/metrics?secret=${encodeURIComponent(secret)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  const body = await res.text()
  if (!res.ok) throw new Error(`/api/metrics HTTP ${res.status}`)
  if (!body.includes('connectintel_up')) throw new Error('metrics body missing connectintel_up')
  console.log('✓ Production metrics scrape OK')
}

async function fetchGrafanaStackFromApi(apiKey, stackSlug) {
  const res = await fetch(`https://grafana.com/api/instances/${stackSlug}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Grafana stack API ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  const promUrl = data.hmInstancePromUrl || data.prometheusUrl
  const promId = String(data.hmInstancePromId || data.prometheusInstanceId || '')
  if (!promUrl || !promId) throw new Error('Grafana stack missing Prometheus remote_write fields')
  return {
    url: promUrl.endsWith('/api/prom/push') ? promUrl : `${promUrl.replace(/\/$/, '')}/api/prom/push`,
    username: promId,
  }
}

async function importGrafanaDashboard({ apiKey, stackSlug }) {
  const dashboard = JSON.parse(readFileSync(DASHBOARD_PATH, 'utf8'))
  const payload = {
    dashboard,
    overwrite: true,
    inputs: [{ name: 'DS_PROMETHEUS', type: 'datasource', pluginId: 'prometheus', value: 'Prometheus' }],
  }
  const res = await fetch(`https://${stackSlug}.grafana.net/api/dashboards/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.warn('Dashboard import:', data?.message || res.status)
    return null
  }
  const url = data.importedUrl || data.url
  console.log(`✓ Dashboard imported${url ? `: https://${stackSlug}.grafana.net${url}` : ''}`)
  return data
}

function setRailwayVar(key, value, service = SERVICE_NAME) {
  const result = spawnSync('npx', ['@railway/cli', 'variable', 'set', key, '--stdin', '--skip-deploys', '-s', service], {
    cwd: ROOT,
    input: value,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  if (result.status !== 0) throw new Error(`Failed to set Railway var ${key}`)
}

function ensureGrafanaAlloyService() {
  const status = railway('status --json', { json: true })
  const services = status?.services?.edges || []
  const existing = services.find((s) => s?.node?.name === SERVICE_NAME)
  if (existing) {
    console.log(`Railway service exists: ${SERVICE_NAME}`)
    railway(`service link ${SERVICE_NAME}`)
    return
  }
  console.log(`Creating Railway service ${SERVICE_NAME} (Dockerfile in infra/grafana)…`)
  railway(`add --service ${SERVICE_NAME} --repo nee9raj-hue/connect-intel --branch main --json`, { json: true })
  railway(`service link ${SERVICE_NAME}`)
  try {
    railway(`service source connect --repo nee9raj-hue/connect-intel --branch main --service ${SERVICE_NAME}`)
  } catch {
    console.warn('GitHub connect skipped — set root directory infra/grafana in Railway dashboard if deploy fails.')
  }
}

function deployAlloy() {
  if (skipDeploy) {
    console.log('Skipping Railway deploy (--skip-deploy)')
    return
  }
  console.log('Deploying grafana-alloy from infra/grafana…')
  run(`npx @railway/cli up infra/grafana -y -d -s ${SERVICE_NAME}`)
}

async function main() {
  console.log('Connect Intel — Grafana connect\n')
  ensureSecretsExample()
  run('npx @railway/cli whoami', { silent: true })

  const deployLocal = parseEnvFile(DEPLOY_LOCAL)
  const grafanaSecrets = parseEnvFile(SECRETS_FILE)
  const metricsSecret = deployLocal.CRON_SECRET || deployLocal.METRICS_SECRET || grafanaSecrets.METRICS_SECRET
  if (!metricsSecret) {
    console.error('Missing CRON_SECRET in .env.deploy.local')
    process.exit(1)
  }

  syncMetricsSecretToVercel(metricsSecret)
  run('vercel deploy --prod --yes')
  await verifyMetricsScrape(metricsSecret)

  let promUrl = grafanaSecrets.GRAFANA_CLOUD_PROMETHEUS_URL
  let promUser = grafanaSecrets.GRAFANA_CLOUD_PROMETHEUS_USERNAME
  let promPass = grafanaSecrets.GRAFANA_CLOUD_PROMETHEUS_PASSWORD
  const grafanaApiKey = grafanaSecrets.GRAFANA_CLOUD_API_KEY
  const stackSlug = grafanaSecrets.GRAFANA_CLOUD_STACK_SLUG

  if ((!promUrl || !promUser || !promPass) && grafanaApiKey && stackSlug) {
    console.log('Fetching Grafana Prometheus remote_write from Cloud API…')
    const stack = await fetchGrafanaStackFromApi(grafanaApiKey, stackSlug)
    promUrl = promUrl || stack.url
    promUser = promUser || stack.username
    promPass = promPass || grafanaApiKey
  }

  if (!promUrl || !promUser || !promPass) {
    console.error(`
Missing Grafana Cloud credentials in ${SECRETS_FILE}

Create free stack: https://grafana.com/auth/sign-up/create-user
Then Prometheus → Details → copy remote_write URL + instance ID.
Create access policy token with metrics:write scope.

Copy .env.grafana.secrets.example → .env.grafana.secrets and re-run:
  npm run grafana:connect
`)
    process.exit(1)
  }

  ensureGrafanaAlloyService()
  console.log('Setting Railway Alloy variables…')
  setRailwayVar('CONNECTINTEL_METRICS_SECRET', metricsSecret)
  setRailwayVar('GRAFANA_CLOUD_PROMETHEUS_URL', promUrl)
  setRailwayVar('GRAFANA_CLOUD_PROMETHEUS_USERNAME', promUser)
  setRailwayVar('GRAFANA_CLOUD_PROMETHEUS_PASSWORD', promPass)

  console.log(`
Railway deploy: in connect-intel-workers project, create service "grafana-alloy":
  Root directory: infra/grafana
  Builder: Dockerfile
  Or run from infra/grafana: npx @railway/cli up -y -d -s grafana-alloy
`)
  if (!skipDeploy) deployAlloy()

  if (grafanaApiKey && stackSlug) {
    await importGrafanaDashboard({ apiKey: grafanaApiKey, stackSlug })
  } else {
    console.log(`\nImport dashboard manually: ${DASHBOARD_PATH}`)
  }

  console.log('\nDone. Grafana Alloy scrapes connectintel.net every 30s → Grafana Cloud.')
  console.log('Logs: npx @railway/cli logs -s grafana-alloy')
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
