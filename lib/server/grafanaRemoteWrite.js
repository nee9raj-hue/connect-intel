import { createRequire } from 'node:module'
import { renderPrometheusMetrics } from './infra/metrics.js'

const require = createRequire(import.meta.url)
const { pushTimeseries } = require('prometheus-remote-write')

/** @returns {{ url: string, auth: { username: string, password: string }, labels: Record<string, string> } | null} */
export function getGrafanaRemoteWriteConfig() {
  const url = String(process.env.GRAFANA_CLOUD_PROMETHEUS_URL || '').trim()
  const username = String(process.env.GRAFANA_CLOUD_PROMETHEUS_USERNAME || '').trim()
  const password = String(process.env.GRAFANA_CLOUD_PROMETHEUS_PASSWORD || '').trim()
  if (!url || !username || !password) return null

  const pushUrl = url.includes('/api/prom/push')
    ? url
    : `${url.replace(/\/$/, '')}/api/prom/push`

  return {
    url: pushUrl,
    auth: { username, password },
    labels: { job: 'connectintel', source: 'vercel-cron' },
  }
}

export function isGrafanaRemoteWriteConfigured() {
  return Boolean(getGrafanaRemoteWriteConfig())
}

/** Parse Prometheus text exposition into remote_write timeseries. */
export function parsePrometheusText(text) {
  const timeseries = []
  const now = Date.now()

  for (const line of String(text || '').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const space = trimmed.lastIndexOf(' ')
    if (space <= 0) continue

    const lhs = trimmed.slice(0, space)
    const rawValue = trimmed.slice(space + 1).trim()
    if (rawValue === 'NaN') continue

    let value
    if (rawValue === '+Inf') value = Number.POSITIVE_INFINITY
    else if (rawValue === '-Inf') value = Number.NEGATIVE_INFINITY
    else {
      value = Number(rawValue)
      if (Number.isNaN(value)) continue
    }

    let name = lhs
    const labels = {}
    const brace = lhs.indexOf('{')
    if (brace >= 0) {
      name = lhs.slice(0, brace)
      const labelStr = lhs.slice(brace + 1, lhs.lastIndexOf('}'))
      for (const part of labelStr.split(',')) {
        if (!part) continue
        const eq = part.indexOf('=')
        if (eq <= 0) continue
        const key = part.slice(0, eq).trim()
        let val = part.slice(eq + 1).trim()
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n')
        }
        labels[key] = val
      }
    }

    timeseries.push({
      labels: { __name__: name, ...labels },
      samples: [{ value, timestamp: now }],
    })
  }

  return timeseries
}

export async function pushPrometheusTextToGrafana(text, config = getGrafanaRemoteWriteConfig()) {
  if (!config) {
    return { ok: false, reason: 'grafana_not_configured' }
  }

  const timeseries = parsePrometheusText(text)
  if (!timeseries.length) {
    return { ok: false, reason: 'no_metrics' }
  }

  const result = await pushTimeseries(timeseries, {
    url: config.url,
    auth: config.auth,
    labels: config.labels,
    fetch: globalThis.fetch,
    timeout: 30_000,
  })

  const ok = result.status === 200 || result.status === 204
  return {
    ok,
    status: result.status,
    statusText: result.statusText,
    error: ok ? null : result.errorMessage || result.statusText,
    series: timeseries.length,
  }
}

export async function pushConnectIntelMetricsToGrafana() {
  const text = renderPrometheusMetrics()
  return pushPrometheusTextToGrafana(text)
}
