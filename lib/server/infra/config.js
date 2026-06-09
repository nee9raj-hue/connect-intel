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
  const url = clean('UPSTASH_REDIS_REST_URL')
  const token = clean('UPSTASH_REDIS_REST_TOKEN')
  return url && token ? { url, token } : null
}

export function isRedisEnabled() {
  return Boolean(getRedisUrl() || getUpstashRestConfig())
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
  return flag('USE_PIPELINE_LEADS_TABLE') || flag('PIPELINE_LEADS_TABLE')
}

export function isPrometheusEnabled() {
  return flag('PROMETHEUS_METRICS') || flag('ENABLE_METRICS')
}

export function getInfraStatus() {
  return {
    redis: isRedisEnabled(),
    meilisearch: isMeilisearchEnabled(),
    pipelineLeadsTable: isPipelineLeadsTableEnabled(),
    prometheus: isPrometheusEnabled(),
  }
}
