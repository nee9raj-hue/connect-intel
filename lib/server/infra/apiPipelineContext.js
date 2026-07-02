import { AsyncLocalStorage } from 'node:async_hooks'
import { logApiPipeline } from './apiPipelineLog.js'

const storage = new AsyncLocalStorage()

export function isObservabilityApiRoute(route = '') {
  const key = String(route || '')
  return key.startsWith('crm/') || key.startsWith('marketing')
}

export function runWithApiPipelineContext(route, fn) {
  return storage.run(
    {
      route: String(route || ''),
      pipelineRowsRead: 0,
      pipelineSource: null,
      loadCount: 0,
    },
    fn
  )
}

/** Record a pipeline read during the current API request (max rows wins). */
export function recordPipelineRead({ rows = 0, source = null } = {}) {
  const ctx = storage.getStore()
  if (!ctx) return
  const n = Math.max(0, Number(rows) || 0)
  ctx.loadCount += 1
  if (n >= ctx.pipelineRowsRead) {
    ctx.pipelineRowsRead = n
    if (source) ctx.pipelineSource = source
  }
}

export function getApiPipelineContext() {
  return storage.getStore() || null
}

export function finalizeApiPipelineRequest({ route, durationMs, statusCode = null }) {
  const ctx = getApiPipelineContext()
  const pipelineRowsRead = ctx?.pipelineRowsRead ?? 0
  const pipelineSource = ctx?.pipelineSource || null
  const shouldLog = isObservabilityApiRoute(route) || pipelineRowsRead > 0
  if (!shouldLog) {
    return { logged: false, pipelineRowsRead, pipelineSource }
  }

  logApiPipeline({
    route,
    durationMs,
    pipelineRowsRead,
    pipelineSource,
    statusCode,
    loadCount: ctx?.loadCount ?? 0,
  })
  return { logged: true, pipelineRowsRead, pipelineSource }
}
