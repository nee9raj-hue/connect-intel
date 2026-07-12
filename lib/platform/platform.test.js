import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlatform, resetPlatformForTests } from './index.js'
import { resolvePlatformConfig } from './config/providers.js'
import { createCompanyRepository } from './repositories/company.js'
import { resolvePipelineListSource } from './repositories/pipeline.js'

test.afterEach(() => {
  resetPlatformForTests()
})

test('resolvePlatformConfig picks sqlite without cloud env', () => {
  const saved = {
    DATABASE_PROVIDER: process.env.DATABASE_PROVIDER,
    SUPABASE_URL: process.env.SUPABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
  }
  delete process.env.DATABASE_PROVIDER
  delete process.env.SUPABASE_URL
  delete process.env.DATABASE_URL
  resetPlatformForTests()
  const config = resolvePlatformConfig()
  assert.equal(config.database, 'sqlite')
  if (saved.DATABASE_PROVIDER) process.env.DATABASE_PROVIDER = saved.DATABASE_PROVIDER
  else delete process.env.DATABASE_PROVIDER
  if (saved.SUPABASE_URL) process.env.SUPABASE_URL = saved.SUPABASE_URL
  else delete process.env.SUPABASE_URL
  if (saved.DATABASE_URL) process.env.DATABASE_URL = saved.DATABASE_URL
  else delete process.env.DATABASE_URL
})

test('createPlatform exposes repositories and provider ports', async () => {
  const platform = createPlatform({
    config: {
      database: 'sqlite',
      auth: 'session-jwt',
      email: 'composite',
      search: 'postgres',
      storage: 'local',
      ai: 'gateway',
      cache: 'memory',
      jobs: 'inline',
      host: 'node',
    },
  })
  assert.ok(platform.repositories.organizations)
  assert.ok(platform.repositories.leads)
  assert.ok(platform.repositories.companies)
  assert.ok(platform.repositories.pipeline)
  assert.equal(platform.database.provider, 'sqlite')
  assert.equal(platform.email.provider, 'composite')
  const health = await platform.health()
  assert.equal(health.contract, '2.0.0')
  assert.ok(health.providers)
})

test('organization repository scopes by org id', async () => {
  const platform = createPlatform({
    database: {
      provider: 'memory-test',
      async readStore() {
        return {
          organizations: [{ id: 'org-a', name: 'A' }, { id: 'org-b', name: 'B' }],
          organizationMemberships: [
            { userId: 'u1', organizationId: 'org-a', status: 'active' },
          ],
          users: [{ id: 'u1', organizationId: 'org-a', email: 'a@test.com' }],
        }
      },
      async writeCollections() {},
      async ping() {
        return true
      },
      async query() {
        return { rows: [] }
      },
    },
  })
  const org = await platform.repositories.organizations.findById('org-a')
  assert.equal(org.name, 'A')
  const members = await platform.repositories.organizations.listMembers('org-a')
  assert.equal(members.length, 1)
})

test('company repository listHub aggregates pipeline entries', async () => {
  const companies = createCompanyRepository()
  const user = {
    id: 'u1',
    organizationId: 'org-a',
    organizationRole: 'org_admin',
  }
  const store = {
    organizations: [{ id: 'org-a', name: 'Org A' }],
    users: [{ id: 'u1', organizationId: 'org-a', email: 'a@test.com' }],
    organizationMemberships: [{ userId: 'u1', organizationId: 'org-a', status: 'active', role: 'org_admin' }],
    savedLeads: [
      {
        organizationId: 'org-a',
        userId: 'u1',
        lead: { id: 'l1', company: 'Acme Corp', city: 'Mumbai' },
        crm: { status: 'new' },
      },
      {
        organizationId: 'org-a',
        userId: 'u1',
        lead: { id: 'l2', company: 'Beta LLC' },
        crm: { status: 'replied' },
      },
    ],
  }

  const page = await companies.listHub(user, store, { limit: 10 })
  assert.equal(page.companies.length, 2)
  assert.equal(page.hierarchyEnabled, false)
  assert.equal(page.fromTable, false)
  assert.ok(page.companies.some((c) => c.name === 'Acme Corp'))
})

test('company repository getDetail returns leads for company', async () => {
  const companies = createCompanyRepository()
  const user = {
    id: 'u1',
    organizationId: 'org-a',
    organizationRole: 'org_admin',
  }
  const store = {
    organizations: [{ id: 'org-a' }],
    users: [{ id: 'u1', organizationId: 'org-a' }],
    organizationMemberships: [{ userId: 'u1', organizationId: 'org-a', status: 'active', role: 'org_admin' }],
    savedLeads: [
      {
        organizationId: 'org-a',
        userId: 'u1',
        lead: { id: 'l1', company: 'Acme Corp', name: 'Jane' },
        crm: { status: 'new' },
      },
    ],
  }

  const list = await companies.listHub(user, store, { limit: 10 })
  const companyId = list.companies[0].id
  const detail = await companies.getDetail(user, store, companyId)
  assert.ok(detail)
  assert.equal(detail.company.name, 'Acme Corp')
  assert.equal(detail.company.leads.length, 1)
  assert.equal(detail.company.leads[0].name, 'Jane')
})

test('pipeline repository exposes read ports', () => {
  const platform = createPlatform({
    config: {
      database: 'sqlite',
      auth: 'session-jwt',
      email: 'composite',
      search: 'postgres',
      storage: 'local',
      ai: 'gateway',
      cache: 'memory',
      jobs: 'inline',
      host: 'node',
    },
  })
  const pipeline = platform.repositories.pipeline
  assert.equal(typeof pipeline.loadListPage, 'function')
  assert.equal(typeof pipeline.loadLeadsByIds, 'function')
  assert.equal(typeof pipeline.loadSummaryOnly, 'function')
  assert.equal(typeof pipeline.loadBoardView, 'function')
  assert.equal(typeof pipeline.loadDealsPage, 'function')
  assert.equal(typeof pipeline.loadSummaryWithDeals, 'function')
})

test('resolvePipelineListSource maps loader flags', () => {
  assert.equal(resolvePipelineListSource({ fromMeili: true }), 'meilisearch')
  assert.equal(resolvePipelineListSource({ fromTable: true }), 'pipeline_leads_table')
  assert.equal(resolvePipelineListSource({}), 'shard')
})
