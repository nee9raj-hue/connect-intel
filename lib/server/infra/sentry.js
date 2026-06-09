/** Optional Sentry — no-op when SENTRY_DSN is unset. */

let sentry = null
let initAttempted = false

async function getSentry() {
  if (initAttempted) return sentry
  initAttempted = true
  const dsn = String(process.env.SENTRY_DSN || '').trim()
  if (!dsn) return null
  try {
    const mod = await import('@sentry/node')
    mod.init({
      dsn,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    })
    sentry = mod
  } catch (error) {
    console.warn('Sentry init skipped:', error?.message || error)
    sentry = null
  }
  return sentry
}

export async function captureException(error, context = {}) {
  const mod = await getSentry()
  if (!mod) {
    console.error('[error]', context.route || context, error?.message || error)
    return
  }
  mod.withScope((scope) => {
    if (context.route) scope.setTag('route', context.route)
    if (context.userId) scope.setUser({ id: context.userId })
    for (const [k, v] of Object.entries(context.tags || {})) {
      scope.setTag(k, v)
    }
    mod.captureException(error)
  })
}

export async function captureMessage(message, level = 'info', context = {}) {
  const mod = await getSentry()
  if (!mod) return
  mod.withScope((scope) => {
    if (context.route) scope.setTag('route', context.route)
    mod.captureMessage(message, level)
  })
}
