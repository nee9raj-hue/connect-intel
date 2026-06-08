import { createId } from './store.js'
import { resolveSegmentLeadIds } from './marketingSegments.js'
import { CRM_STATUSES } from './crm.js'
import { marketingScopeKey } from './marketingAccess.js'
import {
  leadEligibleForMarketingChannel,
  normalizeMarketingChannel,
} from './marketingLeadEligibility.js'
import { getMembership, listPipelineSavedEntries, resolveOrgRole } from './organizations.js'
import {
  chunkArray,
  formatBatchListName,
  MARKETING_SEND_BATCH_SIZE,
  MAX_BATCH_LISTS_PER_REQUEST,
} from '../marketingListBatches.js'

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

function eligibleLeadIdsForAssignee(store, adminUser, assigneeUserId, pipelineStatus = null, channel = 'email') {
  const statusFilter = normalizePipelineStatus(pipelineStatus)
  const ch = normalizeMarketingChannel(channel)
  const entries = listPipelineSavedEntries(store, adminUser)
  return entries
    .filter((entry) => {
      const lead = entry.lead || entry
      if (!leadEligibleForMarketingChannel(lead, ch)) return false
      if (statusFilter && entryPipelineStatus(entry) !== statusFilter) return false
      if (assigneeUserId === '__unassigned__') return !entry.assignedToUserId
      return entry.assignedToUserId === assigneeUserId
    })
    .map((entry) => entry.lead?.id)
    .filter(Boolean)
}

/** @deprecated use eligibleLeadIdsForAssignee */
export function emailableLeadIdsForAssignee(store, adminUser, assigneeUserId, pipelineStatus = null) {
  return eligibleLeadIdsForAssignee(store, adminUser, assigneeUserId, pipelineStatus, 'email')
}

/** Resolve lead ids from smart-list / segment filters (full pipeline, server-side). */
export async function resolveSmartListLeadIds(store, user, options = {}) {
  const { filterJson = {}, assigneeUserId, channel = 'email' } = options
  const listChannel = normalizeMarketingChannel(channel)
  const filters = { ...filterJson }
  if (assigneeUserId) filters.assigneeUserId = assigneeUserId
  const segment = { type: 'dynamic', filterJson: filters, channel: listChannel }
  return resolveSegmentLeadIds(store, user, segment, { channel: listChannel })
}

export function createMarketingListBatches(store, user, options = {}) {
  const {
    namePrefix,
    leadIds: requestedIds,
    assigneeUserId,
    pipelineStatus,
    batchSize = MARKETING_SEND_BATCH_SIZE,
    channel = 'email',
  } = options

  const statusFilter = normalizePipelineStatus(pipelineStatus)
  const statusLabel = pipelineStatusLabel(statusFilter)
  const listChannel = normalizeMarketingChannel(channel)
  const channelLabel = listChannel === 'whatsapp' ? 'WhatsApp' : 'Email'

  const prefix = String(namePrefix || '').trim()
  if (!prefix) throw new Error('List name prefix is required')

  let leadIds = [...new Set(Array.isArray(requestedIds) ? requestedIds : [])]

  if (!assigneeUserId) {
    throw new Error('assigneeUserId is required for batch lists')
  }

  const pool = new Set(
    eligibleLeadIdsForAssignee(store, user, assigneeUserId, statusFilter, listChannel)
  )
  if (leadIds.length) {
    leadIds = leadIds.filter((id) => pool.has(id))
  } else {
    leadIds = [...pool]
  }

  if (!leadIds.length) {
    throw new Error(
      listChannel === 'whatsapp'
        ? 'No leads with a valid mobile number for this rep'
        : 'No leads with email selected for this rep'
    )
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
      channelLabel,
      assigneeUserId ? `Batch ${index + 1} of ${chunks.length}` : null,
      statusLabel,
      `${ids.length} leads`,
    ]
      .filter(Boolean)
      .join(' · '),
    leadIds: ids,
    channel: listChannel,
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

export function isCompanyMarketingAdmin(store, user) {
  if (!user?.organizationId) return false
  if (user.isOrgAdmin && user.accountType === 'company') return true
  const { orgRole, accountType } = resolveOrgRole(user, store)
  return orgRole === 'org_admin' && accountType === 'company'
}

/** Company admins: any rep or unassigned. Team members: own assigned leads only. */
export function assertCanCreateListBatches(store, user, assigneeUserId) {
  if (!user?.organizationId) {
    throw new Error('Company workspace required')
  }
  const { accountType } = resolveOrgRole(user, store)
  if (accountType !== 'company') {
    throw new Error('Batch lists are available for company workspaces only')
  }
  if (!assigneeUserId) {
    throw new Error('assigneeUserId is required for batch lists')
  }

  const isAdmin = isCompanyMarketingAdmin(store, user)

  if (!isAdmin) {
    if (assigneeUserId === '__unassigned__') {
      throw new Error('Only company admins can create lists from unassigned leads')
    }
    if (assigneeUserId !== user.id) {
      throw new Error('You can only create batch lists from your own pipeline leads')
    }
    return
  }

  if (assigneeUserId === '__unassigned__') return
  const member = getMembership(store, assigneeUserId, user.organizationId)
  if (!member) throw new Error('Selected sales leader is not on your team')
}
