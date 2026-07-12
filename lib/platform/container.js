import { PLATFORM_CONTRACT_VERSION } from './contracts/index.js'
import { resolvePlatformConfig } from './config/providers.js'
import { createDatabaseAdapter } from './adapters/database/index.js'
import { createAuthAdapter } from './adapters/auth/index.js'
import { createCacheAdapter } from './adapters/cache/index.js'
import { createEmailAdapter } from './adapters/email/index.js'
import { createSearchAdapter } from './adapters/search/index.js'
import { createStorageAdapter } from './adapters/storage/index.js'
import { createJobsAdapter } from './adapters/jobs/index.js'
import { createAiAdapter } from './adapters/ai/index.js'
import { createOrganizationRepository } from './repositories/organization.js'
import { createLeadRepository } from './repositories/lead.js'
import { createCompanyRepository } from './repositories/company.js'
import { createPipelineRepository } from './repositories/pipeline.js'

let platformSingleton = null

export function createPlatform(overrides = {}) {
  const config = { ...resolvePlatformConfig(), ...overrides.config }
  const database = overrides.database || createDatabaseAdapter(config.database)
  const auth = overrides.auth || createAuthAdapter(config.auth)
  const cache = overrides.cache || createCacheAdapter(config.cache)
  const email = overrides.email || createEmailAdapter(config.email)
  const search = overrides.search || createSearchAdapter(config.search)
  const storage = overrides.storage || createStorageAdapter(config.storage)
  const jobs = overrides.jobs || createJobsAdapter(config.jobs)
  const ai = overrides.ai || createAiAdapter(config.ai)

  const deps = { database, cache }

  return {
    version: PLATFORM_CONTRACT_VERSION,
    config,
    database,
    auth,
    cache,
    email,
    search,
    storage,
    jobs,
    ai,
    repositories: {
      organizations: createOrganizationRepository(deps),
      leads: createLeadRepository(deps),
      companies: createCompanyRepository(),
      pipeline: createPipelineRepository(deps),
    },
    async health() {
      const [dbOk, searchOk] = await Promise.all([
        database.ping().catch(() => false),
        search.ping().catch(() => ({ ok: false })),
      ])
      return {
        ok: Boolean(dbOk),
        contract: PLATFORM_CONTRACT_VERSION,
        providers: config,
        database: { ok: Boolean(dbOk), provider: database.provider },
        search: { ...searchOk, provider: search.provider },
        jobs: { provider: jobs.provider },
        host: config.host,
      }
    },
  }
}

/** Singleton platform kernel — inject in handlers during gradual migration. */
export function getPlatform() {
  if (!platformSingleton) {
    platformSingleton = createPlatform()
  }
  return platformSingleton
}

export function resetPlatformForTests() {
  platformSingleton = null
}
