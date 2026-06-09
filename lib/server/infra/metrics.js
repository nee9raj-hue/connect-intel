/** In-process Prometheus-style metrics (exported at GET /api/metrics). */

const counters = new Map()
const histograms = new Map()

function counterKey(name, labels) {
  const parts = Object.entries(labels || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
  return parts.length ? `${name}{${parts.join(',')}}` : name
}

export function incCounter(name, labels = {}, delta = 1) {
  const key = counterKey(name, labels)
  counters.set(key, (counters.get(key) || 0) + delta)
}

export function observeHistogram(name, value, labels = {}, buckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
  const key = counterKey(name, labels)
  if (!histograms.has(key)) {
    histograms.set(key, { sum: 0, count: 0, buckets: Object.fromEntries(buckets.map((b) => [b, 0])) })
  }
  const row = histograms.get(key)
  row.sum += value
  row.count += 1
  for (const b of buckets) {
    if (value <= b) row.buckets[b] += 1
  }
}

export async function timeAsync(name, labels, fn) {
  const started = performance.now()
  try {
    const result = await fn()
    observeHistogram(`${name}_duration_seconds`, (performance.now() - started) / 1000, labels)
    incCounter(`${name}_total`, { ...labels, status: 'ok' })
    return result
  } catch (error) {
    observeHistogram(`${name}_duration_seconds`, (performance.now() - started) / 1000, labels)
    incCounter(`${name}_total`, { ...labels, status: 'error' })
    throw error
  }
}

export function renderPrometheusMetrics() {
  const lines = []
  lines.push('# HELP connectintel_up Connect Intel process is running.')
  lines.push('# TYPE connectintel_up gauge')
  lines.push('connectintel_up 1')

  for (const [key, value] of counters) {
    const name = key.split('{')[0]
    if (!lines.some((l) => l.includes(`TYPE ${name}`))) {
      lines.push(`# TYPE ${name} counter`)
    }
    lines.push(`${key} ${value}`)
  }

  for (const [key, row] of histograms) {
    const name = `${key.split('{')[0]}_bucket`
    const baseLabels = key.includes('{') ? key.slice(key.indexOf('{')) : ''
    if (!lines.some((l) => l.includes(`TYPE ${name}`))) {
      lines.push(`# TYPE ${name} histogram`)
    }
    for (const [le, count] of Object.entries(row.buckets)) {
      const labelBody = baseLabels ? baseLabels.slice(1, -1) + ',le="' + le + '"' : `le="${le}"`
      lines.push(`${name.split('{')[0]}{${labelBody}} ${count}`)
    }
    const sumKey = key.replace(/}$/, '') + (baseLabels ? ',' : '') + '}'
    lines.push(`${key.split('{')[0]}_sum${baseLabels || ''} ${row.sum}`.replace('{}', ''))
    lines.push(`${key.split('{')[0]}_count${baseLabels || ''} ${row.count}`.replace('{}', ''))
  }

  return `${lines.join('\n')}\n`
}
