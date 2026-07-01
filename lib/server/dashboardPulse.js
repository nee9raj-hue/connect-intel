import {
  dashboardSnapshotCollection,
  readSnapshotPayload,
  teamSnapshotCollection,
} from './dashboardSnapshots.js'
import { readPipelineIndexDoc } from './pipelineIndex.js'
import { pipelineShardNameForUser } from './pipelineShard.js'

export async function buildDashboardPulse(user) {
  const orgId = user.organizationId
  const parts = []
  let lastUpdated = null

  if (orgId) {
    const [dash, team] = await Promise.all([
      readSnapshotPayload(dashboardSnapshotCollection(orgId)),
      readSnapshotPayload(teamSnapshotCollection(orgId, 'week')),
    ])
    if (dash?.updatedAt) parts.push(`d:${dash.updatedAt}`)
    if (team?.updatedAt) parts.push(`t:${team.updatedAt}`)
    const stamps = [dash?.updatedAt, team?.updatedAt].filter(Boolean)
    if (stamps.length) lastUpdated = stamps.sort().pop()
  }

  const shard = pipelineShardNameForUser(user)
  if (shard) {
    const index = await readPipelineIndexDoc(shard)
    if (index?.updatedAt) {
      parts.push(`i:${index.updatedAt}`)
      if (!lastUpdated) lastUpdated = index.updatedAt
    }
  }

  const version = parts.join('|') || `static:${orgId || user.id}`
  return { version, lastUpdated: lastUpdated || null }
}
