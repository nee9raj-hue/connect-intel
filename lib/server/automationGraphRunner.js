import { readStore, updateStore } from './store.js'
import { buildOrgUserResponse } from './organizations.js'
import { enrollCampaign, getMarketingList } from './marketingCampaigns.js'
import { getMarketingSegment, resolveSegmentLeadIds } from './marketingSegments.js'
import { loadPipelineStoreForLeadIds } from './pipelineShard.js'
import { writeCampaignSendShard } from './marketingCampaignSendShard.js'
import { findPipelineEntry } from './pipelineAccess.js'

function nodeById(graph, id) {
  return (graph?.nodes || []).find((n) => n.id === id)
}

function nextNodeId(graph, fromId, branch) {
  const edges = (graph?.edges || []).filter((e) => e.from === fromId)
  if (branch) {
    const match = edges.find((e) => e.branch === branch || e.label === branch)
    if (match) return match.to
  }
  return edges[0]?.to || null
}

function evaluateCondition(node, store, user, run) {
  const config = node.config || {}
  const entry = findPipelineEntry(store, user, run.leadId)
  const lead = entry?.lead || entry
  const crm = entry?.crm || {}

  if (config.type === 'lead_stage') {
    return (crm.status || 'new') === config.value
  }
  if (config.type === 'tag_exists') {
    return (crm.tagIds || []).includes(config.tagId)
  }
  if (config.type === 'country') {
    const country = String(lead?.country || '').toLowerCase()
    return country.includes(String(config.value || '').toLowerCase())
  }
  return true
}

export async function executeAutomationGraphStep(automation, run) {
  const store = await readStore({
    only: [
      'marketingAutomations',
      'marketingAutomationRuns',
      'marketingCampaigns',
      'marketingLists',
      'marketingSegments',
      'marketingTemplates',
      'marketingSuppressions',
      'users',
      'organizations',
      'organizationMemberships',
      'savedLeads',
    ],
  })

  const owner = store.users.find((u) => u.id === automation.createdByUserId)
  if (!owner) throw new Error('Automation owner not found')
  const user = buildOrgUserResponse(owner, store)

  const graph = automation.graph || { nodes: [], edges: [] }
  let nodeId = run.currentNodeId || graph.nodes?.[0]?.id
  let steps = 0
  const maxSteps = 12

  while (nodeId && steps < maxSteps) {
    steps += 1
    const node = nodeById(graph, nodeId)
    if (!node) break

    if (node.type === 'trigger') {
      nodeId = nextNodeId(graph, nodeId)
      continue
    }

    if (node.type === 'delay') {
      const days = Number(node.config?.delayDays ?? node.delayDays ?? automation.delayDays) || 0
      const nextAt = new Date(Date.now() + days * 86400000).toISOString()
      await updateRun(run.id, { currentNodeId: nextNodeId(graph, nodeId), nextRunAt: nextAt, status: 'pending' })
      return { deferred: true, days }
    }

    if (node.type === 'condition') {
      const pass = evaluateCondition(node, store, user, run)
      nodeId = nextNodeId(graph, nodeId, pass ? 'yes' : 'no')
      continue
    }

    if (node.type === 'action') {
      const action = node.config?.action || node.action || 'send_email'
      if (action === 'send_email' || node.label?.toLowerCase?.().includes('send')) {
        const campaignId = node.config?.campaignId || automation.campaignId
        if (!campaignId) throw new Error('No campaign linked to send action')

        const campaign = (store.marketingCampaigns || []).find((c) => c.id === campaignId)
        if (!campaign) throw new Error('Campaign not found')

        let list = { id: 'auto_single', leadIds: [run.leadId], channel: campaign.channel || 'email' }
        if (automation.listId) {
          const l = getMarketingList(store, user, automation.listId)
          if (l) list = l
        } else if (automation.segmentId) {
          const segment = getMarketingSegment(store, user, automation.segmentId)
          const leadIds = await resolveSegmentLeadIds(store, user, segment)
          list = { id: `seg_${segment.id}`, leadIds: [run.leadId], channel: segment?.channel || 'email' }
        }

        const { pipelineStore } = await loadPipelineStoreForLeadIds(user, [run.leadId])
        const fullStore = { ...store, savedLeads: pipelineStore.savedLeads }
        const enrolled = await enrollCampaign(fullStore, user, campaign, list)
        await writeCampaignSendShard(fullStore, user, { ...campaign, status: 'active' })
        nodeId = nextNodeId(graph, nodeId)
        return { sent: enrolled > 0 ? 1 : 0, enrolled }
      }

      if (action === 'exit') {
        break
      }
    }

    nodeId = nextNodeId(graph, nodeId)
  }

  return { completed: true }
}

async function updateRun(runId, patch) {
  const now = new Date().toISOString()
  await updateStore((draft) => {
    const row = (draft.marketingAutomationRuns || []).find((r) => r.id === runId)
    if (row) Object.assign(row, patch, { updatedAt: now })
    return draft
  })
}
