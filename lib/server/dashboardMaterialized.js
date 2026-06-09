import { readPipelineShardEntries } from './pipelineShard.js'
import { buildPipelineIndexDoc, writePipelineIndexDoc } from './pipelineIndex.js'
import { getOrganization } from './organizations.js'
import { isFreightDealOrg } from '../freightDeal.js'
import { readStore } from './store.js'
import { cacheSet, pipelineSummaryCacheKey } from './infra/cache.js'

/** Refresh precomputed pipeline_index_* doc (materialized summary for dashboard/pipeline). */
export async function refreshPipelineIndexForShard(shardName) {
  if (!shardName) return null
  const entries = (await readPipelineShardEntries(shardName, { bypassCache: true })) || []
  const orgId = shardName.startsWith('pipeline_org_') ? shardName.replace('pipeline_org_', '') : null
  let freightOrg = false
  if (orgId) {
    const meta = await readStore({ only: ['organizations'] })
    const org = getOrganization(meta, orgId)
    freightOrg = isFreightDealOrg(org, null)
  }
  const doc = buildPipelineIndexDoc(entries, { freightOrg, organizationId: orgId })
  await writePipelineIndexDoc(shardName, doc)
  await cacheSet(pipelineSummaryCacheKey(shardName), doc, { ttlSeconds: 120 })
  return { shardName, total: doc.total, updatedAt: doc.updatedAt }
}
