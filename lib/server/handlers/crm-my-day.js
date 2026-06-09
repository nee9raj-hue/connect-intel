import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { cacheGet, cacheSet, myDayCacheKey } from '../infra/cache.js'
import { readMyDaySnapshot } from '../dashboardSnapshots.js'
import { computeMyDayLegacy } from '../dashboardLegacy.js'
import { timeAsync } from '../infra/metrics.js'
import { resolveTimeZone } from '../../calendarLocale.js'

const TTL = 60
const STALE = 180

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const timeZone = resolveTimeZone(user, new URL(req.url || '', 'http://localhost').searchParams.get('tz'))

  const cacheKey = myDayCacheKey(user)
  const cached = await cacheGet(cacheKey, { ttlSeconds: TTL, staleSeconds: STALE })
  if (cached.value && !cached.stale) {
    return sendJson(res, 200, { ...cached.value, _cache: { hit: true, source: cached.source } })
  }

  const snap = await readMyDaySnapshot(user)
  let myDay = snap.myDay
  let source = snap.source

  if (snap.source !== 'snapshot' || snap.myDay?._warming) {
    try {
      myDay = await timeAsync('connectintel_my_day_legacy', {}, () =>
        computeMyDayLegacy(user, { timeZone })
      )
      source = 'legacy_compute'
    } catch (error) {
      console.warn('my-day legacy fallback failed:', error?.message || error)
    }
  }

  const payload = {
    myDay,
    _snapshot: { fresh: snap.fresh, source, updatedAt: snap.updatedAt },
  }

  void cacheSet(cacheKey, payload, { ttlSeconds: TTL })

  return sendJson(res, 200, {
    ...payload,
    _cache: { hit: false, stale: cached.stale },
  })
}
