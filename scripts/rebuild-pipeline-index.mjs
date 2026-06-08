/**
 * Rebuild precomputed pipeline summary indexes for all org/user shards.
 * Run after deploy: node scripts/rebuild-pipeline-index.mjs
 */
import { readStore, isPipelineShardCollection } from '../lib/server/store.js'
import { refreshPipelineIndex, pipelineIndexCollectionName } from '../lib/server/pipelineIndex.js'
import { getOrganization } from '../lib/server/organizations.js'
import { isFreightDealOrg } from '../lib/freightDeal.js'
import { fetchAllCollections } from '../lib/server/supabaseClient.js'
import { isSupabaseEnabled } from '../lib/server/supabaseClient.js'

async function listShardCollections() {
  if (isSupabaseEnabled()) {
    const rows = await fetchAllCollections('store_collections?select=collection')
    return rows.map((r) => r.collection).filter((c) => isPipelineShardCollection(c))
  }
  const store = await readStore()
  return Object.keys(store).filter((c) => isPipelineShardCollection(c))
}

async function loadShardEntries(shardName) {
  if (isSupabaseEnabled()) {
    const { fetchStoreCollectionJson } = await import('../lib/server/supabaseClient.js')
    return fetchStoreCollectionJson(shardName)
  }
  const store = await readStore({ only: [shardName] })
  return store[shardName] || []
}

async function main() {
  const shards = await listShardCollections()
  if (!shards.length) {
    console.log('No pipeline shards found.')
    return
  }

  let rebuilt = 0
  for (const shardName of shards) {
    const entries = await loadShardEntries(shardName)
    if (!Array.isArray(entries) || !entries.length) {
      console.log(`Skip empty shard ${shardName}`)
      continue
    }
    const orgId = shardName.startsWith('pipeline_org_')
      ? shardName.replace('pipeline_org_', '')
      : null
    let freightOrg = false
    if (orgId) {
      const store = await readStore({ only: ['organizations'] })
      const org = getOrganization(store, orgId)
      freightOrg = isFreightDealOrg(org, null)
    }
    await refreshPipelineIndex(shardName, entries, { freightOrg, organizationId: orgId })
    const indexName = pipelineIndexCollectionName(shardName)
    console.log(`✓ ${shardName} → ${indexName} (${entries.length} leads)`)
    rebuilt += 1
  }

  console.log(`\nRebuilt ${rebuilt} pipeline index(es).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
