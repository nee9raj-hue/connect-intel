import { meiliEnabled, meiliSearch, MEILI_CRM_INDEX } from './client.js'
import { isPipelineEntryVisibleAsync } from '../pipelineVisibility.js'
import { meiliDocToEntryStub } from './pipelineSearchStub.js'

/**
 * Meilisearch → visible pipeline lead IDs (role-scoped), relevance order preserved.
 */
export async function searchVisiblePipelineLeadIds(user, metaStore, q, { limit = 500, assigneeUserId = null } = {}) {
  const query = String(q || '').trim()
  if (query.length < 2 || !meiliEnabled()) return null

  const filterParts = []
  if (user.organizationId) {
    filterParts.push(`organizationId = "${user.organizationId}"`)
  }
  filterParts.push('type = lead')
  const ownerId = String(assigneeUserId || '').trim()
  if (ownerId && ownerId !== '__unassigned__') {
    filterParts.push(`ownerUserId = "${ownerId}"`)
  }

  const fetchLimit = Math.min(Math.max(limit * 3, limit), 1000)
  const hits = await meiliSearch(MEILI_CRM_INDEX, {
    q: query,
    limit: fetchLimit,
    filter: filterParts.join(' AND '),
  })

  const leadIds = []
  const candidates = hits?.hits || []
  const visibility = await Promise.all(
    candidates.map((doc) =>
      doc?.leadId
        ? isPipelineEntryVisibleAsync(user, meiliDocToEntryStub(doc), metaStore)
        : Promise.resolve(false)
    )
  )

  for (let i = 0; i < candidates.length; i += 1) {
    const doc = candidates[i]
    if (!visibility[i] || !doc?.leadId) continue
    leadIds.push(String(doc.leadId))
    if (leadIds.length >= limit) break
  }

  return leadIds
}
