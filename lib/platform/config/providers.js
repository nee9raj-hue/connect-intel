/**
 * Provider resolution — every external system is selected via env, never hardcoded.
 * Constitution: cloud-agnostic, replaceable infrastructure.
 */

function envFlag(name) {
  const v = String(process.env[name] || '')
    .trim()
    .toLowerCase()
  if (v === 'false' || v === '0' || v === 'no') return false
  if (v === 'true' || v === '1' || v === 'yes') return true
  return null
}

function cleanEnv(name) {
  const raw = process.env[name]
  if (!raw) return ''
  return String(raw).trim().replace(/^["']|["']$/g, '')
}

export const PROVIDER_ENV_KEYS = {
  database: 'DATABASE_PROVIDER',
  auth: 'AUTH_PROVIDER',
  email: 'EMAIL_PROVIDER',
  search: 'SEARCH_PROVIDER',
  storage: 'STORAGE_PROVIDER',
  ai: 'AI_PROVIDER',
  cache: 'CACHE_PROVIDER',
  jobs: 'JOBS_PROVIDER',
  host: 'HOST_PROVIDER',
}

export function resolveDatabaseProvider() {
  const explicit = cleanEnv(PROVIDER_ENV_KEYS.database).toLowerCase()
  if (['postgres', 'supabase-rest', 'sqlite'].includes(explicit)) return explicit
  if (cleanEnv('DATABASE_URL') || cleanEnv('DIRECT_URL') || cleanEnv('SUPABASE_DB_PASSWORD')) {
    return 'postgres'
  }
  if (cleanEnv('SUPABASE_URL') && (cleanEnv('SUPABASE_SERVICE_ROLE_KEY') || cleanEnv('SUPABASE_SECRET_KEY'))) {
    return 'supabase-rest'
  }
  return 'sqlite'
}

export function resolveAuthProvider() {
  const explicit = cleanEnv(PROVIDER_ENV_KEYS.auth).toLowerCase()
  if (
    ['session-jwt', 'supabase-auth', 'google-oauth', 'azure-ad', 'okta', 'saml'].includes(explicit)
  ) {
    return explicit
  }
  return 'session-jwt'
}

export function resolveEmailProvider() {
  const explicit = cleanEnv(PROVIDER_ENV_KEYS.email).toLowerCase()
  if (['composite', 'smtp', 'resend', 'gmail', 'ses'].includes(explicit)) return explicit
  return 'composite'
}

export function resolveSearchProvider() {
  const explicit = cleanEnv(PROVIDER_ENV_KEYS.search).toLowerCase()
  if (['postgres', 'meilisearch', 'none'].includes(explicit)) return explicit
  if (cleanEnv('MEILI_HOST') && cleanEnv('MEILI_API_KEY')) return 'meilisearch'
  return 'postgres'
}

export function resolveStorageProvider() {
  const explicit = cleanEnv(PROVIDER_ENV_KEYS.storage).toLowerCase()
  if (['local', 's3', 'r2', 'minio', 'supabase-storage'].includes(explicit)) return explicit
  return 'local'
}

export function resolveAiProvider() {
  const explicit = cleanEnv(PROVIDER_ENV_KEYS.ai).toLowerCase()
  if (['gateway', 'gemini', 'openai', 'anthropic', 'perplexity', 'none'].includes(explicit)) return explicit
  return 'gateway'
}

export function resolveCacheProvider() {
  const explicit = cleanEnv(PROVIDER_ENV_KEYS.cache).toLowerCase()
  if (['memory', 'redis', 'memory-redis'].includes(explicit)) return explicit
  if (cleanEnv('REDIS_URL') || cleanEnv('KV_REST_API_URL')) return 'memory-redis'
  return 'memory'
}

export function resolveJobsProvider() {
  const explicit = cleanEnv(PROVIDER_ENV_KEYS.jobs).toLowerCase()
  if (['inline', 'bullmq', 'manual'].includes(explicit)) return explicit
  if (cleanEnv('REDIS_URL')) return 'bullmq'
  return 'inline'
}

export function resolveHostProvider() {
  const explicit = cleanEnv(PROVIDER_ENV_KEYS.host).toLowerCase()
  if (['vercel', 'docker', 'railway', 'render', 'node', 'cloudflare'].includes(explicit)) return explicit
  if (process.env.VERCEL) return 'vercel'
  if (process.env.RAILWAY_ENVIRONMENT) return 'railway'
  if (process.env.RENDER) return 'render'
  return 'node'
}

export function resolvePlatformConfig() {
  return {
    database: resolveDatabaseProvider(),
    auth: resolveAuthProvider(),
    email: resolveEmailProvider(),
    search: resolveSearchProvider(),
    storage: resolveStorageProvider(),
    ai: resolveAiProvider(),
    cache: resolveCacheProvider(),
    jobs: resolveJobsProvider(),
    host: resolveHostProvider(),
    mvpZeroCost: envFlag('MVP_ZERO_COST') !== false,
    apiBaseUrl: cleanEnv('API_BASE_URL') || cleanEnv('APP_URL') || '',
  }
}
