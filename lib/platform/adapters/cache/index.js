import { cacheGet, cacheInvalidate, cacheSet } from '../../../server/infra/cache.js'

export function createMemoryCacheAdapter() {
  return {
    provider: 'memory',
    get: (key, options) => cacheGet(key, options),
    set: (key, value, options) => cacheSet(key, value, options),
    invalidate: (key) => cacheInvalidate(key),
  }
}

export function createCacheAdapter(provider) {
  // memory-redis uses same composite implementation (redis optional inside cache.js)
  switch (provider) {
    case 'memory':
    case 'redis':
    case 'memory-redis':
    default:
      return createMemoryCacheAdapter()
  }
}
