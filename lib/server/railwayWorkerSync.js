/**
 * Push worker env from Vercel runtime → Railway email-worker service.
 * Vercel holds sensitive vars; Railway CLI cannot re-export them locally.
 */

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'

const WORKER_PROJECT_ID = '778338fb-1127-49e4-b1b4-7043e3a5bdb1'
const WORKER_SERVICE_ID = 'a231b063-0239-4fdb-b0dd-b87339491211'
const WORKER_ENVIRONMENT_ID = '5d0be8d4-90b2-45f9-b41f-06c3bc678134'

const WORKER_ENV_KEYS = [
  'REDIS_URL',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
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
  'EMAIL_WORKER_ONLY',
  'EMAIL_WORKER_CONCURRENCY',
  'WORKER_CONCURRENCY',
]

function clean(name) {
  const raw = process.env[name]
  if (!raw) return ''
  return String(raw).trim().replace(/^["']|["']$/g, '')
}

async function railwayGraphql(token, query, variables) {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(60_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.errors?.length) {
    const msg = data?.errors?.[0]?.message || `Railway API HTTP ${res.status}`
    throw new Error(msg)
  }
  return data?.data
}

async function upsertRailwayVariable(token, name, value) {
  const query = `
    mutation variableUpsert($input: VariableUpsertInput!) {
      variableUpsert(input: $input)
    }
  `
  await railwayGraphql(token, query, {
    input: {
      projectId: WORKER_PROJECT_ID,
      environmentId: WORKER_ENVIRONMENT_ID,
      serviceId: WORKER_SERVICE_ID,
      name,
      value,
    },
  })
}

export async function syncWorkerEnvToRailway() {
  const token = clean('RAILWAY_API_TOKEN')
  if (!token) {
    return {
      ok: false,
      error: 'RAILWAY_API_TOKEN not set on Vercel',
      hint: 'Add Railway account token to Vercel production env, redeploy, retry.',
    }
  }

  const set = []
  const skipped = []
  const missing = []

  for (const key of WORKER_ENV_KEYS) {
    const value = clean(key)
    if (!value) {
      missing.push(key)
      continue
    }
    await upsertRailwayVariable(token, key, value)
    set.push(key)
  }

  return {
    ok: missing.filter((k) =>
      ['SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'].includes(k)
    ).length === 0,
    set,
    missing,
    skipped,
    projectId: WORKER_PROJECT_ID,
    serviceId: WORKER_SERVICE_ID,
  }
}
