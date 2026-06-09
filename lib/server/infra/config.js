/** Central feature flags for optional infrastructure (Redis, Meilisearch, pipeline table). */

function clean(name) {
  const raw = process.env[name]
  if (!raw) return ''
  return String(raw).trim().replace(/^["']|["']$/g, '')
}

function flag(name) {
  const v = clean(name).toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function getRedisUrl() {
  return clean('REDIS_URL') || clean('UPSTASH_REDIS_URL')
}

export function getUpstashRestConfig() {
  const url = clean('UPSTASH_REDIS_REST_URL') || clean('KV_REST_API_URL')
  const token = clean('UPSTASH_REDIS_REST_TOKEN') || clean('KV_REST_API_TOKEN')
  return url && token ? { url, token } : null
}

export function isRedisEnabled() {
  return Boolean(getRedisUrl() || getUpstashRestConfig())
}

/** True when Redis + Railway worker handle sends (browser not required). */
export function isBackgroundEmailEnabled() {
  if (flag('BACKGROUND_EMAIL_SENDS') && !isRedisEnabled()) return false
  if (flag('BACKGROUND_EMAIL_SENDS_OFF')) return false
  return isRedisEnabled()
}

export function getMeilisearchConfig() {
  const host = clean('MEILI_HOST') || clean('MEILISEARCH_HOST')
  const apiKey = clean('MEILI_API_KEY') || clean('MEILISEARCH_API_KEY')
  return host && apiKey ? { host: host.replace(/\/$/, ''), apiKey } : null
}

export function isMeilisearchEnabled() {
  return Boolean(getMeilisearchConfig())
}

export function isPipelineLeadsTableEnabled() {
  if (flag('PIPELINE_LEADS_TABLE_OFF') || flag('DISABLE_PIPELINE_LEADS_TABLE')) return false
  if (flag('USE_PIPELINE_LEADS_TABLE') || flag('PIPELINE_LEADS_TABLE')) return true
  const url = clean('SUPABASE_URL') || clean('NEXT_PUBLIC_SUPABASE_URL')
  const key =
    clean('SUPABASE_SERVICE_ROLE_KEY') ||
    clean('SUPABASE_ANON_KEY') ||
    clean('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return Boolean(url && key)
}

export function isPrometheusEnabled() {
  return flag('PROMETHEUS_METRICS') || flag('ENABLE_METRICS')
}

export function getInfraStatus() {
  return {
    redis: isRedisEnabled(),
    backgroundEmail: isBackgroundEmailEnabled(),
    meilisearch: isMeilisearchEnabled(),
    pipelineLeadsTable: isPipelineLeadsTableEnabled(),
    prometheus: isPrometheusEnabled(),
  }
}
