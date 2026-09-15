/** USD → INR for ocean freight revenue. Live rate with a short cache; fallback if the feed is down. */

export const FALLBACK_USD_INR = 88

const TTL_MS = 60 * 60 * 1000
const FRANKFURTER_URL = 'https://api.frankfurter.app/latest?from=USD&to=INR'

let cache = { rate: null, fetchedAt: 0, asOf: null, source: null }

export function convertUsdToInr(usd, rate) {
  const amount = Number(usd)
  const fx = Number(rate)
  if (!Number.isFinite(amount) || !Number.isFinite(fx) || fx <= 0) return null
  return Math.round(amount * fx * 100) / 100
}

export async function getUsdInrRate({ force = false } = {}) {
  const now = Date.now()
  if (!force && cache.rate && now - cache.fetchedAt < TTL_MS) {
    return { rate: cache.rate, asOf: cache.asOf, source: cache.source }
  }

  try {
    const res = await fetch(FRANKFURTER_URL, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    const rate = Number(data?.rates?.INR)
    if (Number.isFinite(rate) && rate > 1 && rate < 200) {
      cache = {
        rate,
        fetchedAt: now,
        asOf: data.date || null,
        source: 'frankfurter',
      }
      return { rate: cache.rate, asOf: cache.asOf, source: cache.source }
    }
  } catch {
    /* use cache or fallback */
  }

  if (cache.rate) {
    return { rate: cache.rate, asOf: cache.asOf, source: cache.source || 'cache' }
  }

  return { rate: FALLBACK_USD_INR, asOf: null, source: 'fallback' }
}
