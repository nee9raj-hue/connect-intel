import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  dashboardSnapshotCollection,
  readSnapshotPayload,
  teamSnapshotCollection,
} from '../dashboardSnapshots.js'
import { readPipelineIndexDoc } from '../pipelineIndex.js'
import { pipelineShardNameForUser } from '../pipelineShard.js'

async function buildDashboardPulse(user) {
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

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const pulse = await buildDashboardPulse(user)
  return sendJson(res, 200, pulse)
}
