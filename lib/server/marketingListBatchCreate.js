import { createId } from './store.js'
import { CRM_STATUSES } from './crm.js'
import { marketingScopeKey } from './marketingAccess.js'
import { getMembership, listPipelineSavedEntries } from './organizations.js'
import {
  chunkArray,
  formatBatchListName,
  MARKETING_SEND_BATCH_SIZE,
  MAX_BATCH_LISTS_PER_REQUEST,
} from '../marketingListBatches.js'

function leadHasEmail(entry) {
  const email = String(entry?.lead?.email || '').trim()
  return email.includes('@') && !email.includes('•')
}

function normalizePipelineStatus(status) {
  const id = String(status || '').trim()
  if (!id || id === 'all') return null
  if (!CRM_STATUSES.includes(id)) return null
  return id
}

function entryPipelineStatus(entry) {
  return entry?.crm?.status || 'new'
}

export function pipelineStatusLabel(statusId) {
  const id = normalizePipelineStatus(statusId)
  if (!id) return null
  const labels = {
    new: 'New',
    contacted: 'Contacted',
    follow_up: 'Follow up',
    replied: 'Replied',
    won: 'Won',
    active_trading: 'Active trading',
    lost: 'Lost',
  }
  return labels[id] || id
}

export function emailableLeadIdsForAssignee(store, adminUser, assigneeUserId, pipelineStatus = null) {
  const statusFilter = normalizePipelineStatus(pipelineStatus)
  const entries = listPipelineSavedEntries(store, adminUser)
  return entries
    .filter((entry) => {
      if (!leadHasEmail(entry)) return false
      if (statusFilter && entryPipelineStatus(entry) !== statusFilter) return false
      if (assigneeUserId === '__unassigned__') return !entry.assignedToUserId
      return entry.assignedToUserId === assigneeUserId
    })
    .map((entry) => entry.lead?.id)
    .filter(Boolean)
}

export function createMarketingListBatches(store, user, options = {}) {
  const {
    namePrefix,
    leadIds: requestedIds,
    assigneeUserId,
    pipelineStatus,
    batchSize = MARKETING_SEND_BATCH_SIZE,
  } = options

  const statusFilter = normalizePipelineStatus(pipelineStatus)
  const statusLabel = pipelineStatusLabel(statusFilter)

  const prefix = String(namePrefix || '').trim()
  if (!prefix) throw new Error('List name prefix is required')

  let leadIds = [...new Set(Array.isArray(requestedIds) ? requestedIds : [])]

  if (!assigneeUserId) {
    throw new Error('assigneeUserId is required for batch lists')
  }

  const pool = new Set(emailableLeadIdsForAssignee(store, user, assigneeUserId, statusFilter))
  if (leadIds.length) {
    leadIds = leadIds.filter((id) => pool.has(id))
  } else {
    leadIds = [...pool]
  }

  if (!leadIds.length) {
    throw new Error('No leads with email selected for this rep')
  }

  const chunks = chunkArray(leadIds, Math.min(Math.max(batchSize, 1), 200))
  if (chunks.length > MAX_BATCH_LISTS_PER_REQUEST) {
    throw new Error(
      `Too many batches (${chunks.length}). Max ${MAX_BATCH_LISTS_PER_REQUEST} lists (${MAX_BATCH_LISTS_PER_REQUEST * batchSize} leads) per action.`
    )
  }

  const now = new Date().toISOString()
  const scope = marketingScopeKey(user)
  const lists = chunks.map((ids, index) => ({
    id: createId('mlist'),
    ...scope,
    name: formatBatchListName(prefix, index, chunks.length),
    description: [
      assigneeUserId ? `Batch ${index + 1} of ${chunks.length}` : null,
      statusLabel,
      `${ids.length} leads`,
    ]
      .filter(Boolean)
      .join(' · '),
    leadIds: ids,
    assigneeUserId: assigneeUserId && assigneeUserId !== '__unassigned__' ? assigneeUserId : null,
    pipelineStatus: statusFilter,
    createdByUserId: user.id,
    createdAt: now,
    updatedAt: now,
  }))

  store.marketingLists = store.marketingLists || []
  for (const list of lists) {
    store.marketingLists.push(list)
  }

  return {
    lists,
    batchCount: lists.length,
    totalLeads: leadIds.length,
    batchSize,
  }
}

export function assertOrgAdminForListBatches(user, store, assigneeUserId) {
  if (!user?.organizationId) {
    throw new Error('Company workspace required')
  }
  if (!user.isOrgAdmin && user.orgRole !== 'org_admin') {
    throw new Error('Only company admins can create rep batch lists')
  }
  if (!assigneeUserId) return
  if (assigneeUserId === '__unassigned__') return
  const member = getMembership(store, assigneeUserId, user.organizationId)
  if (!member) throw new Error('Selected sales leader is not on your team')
}
