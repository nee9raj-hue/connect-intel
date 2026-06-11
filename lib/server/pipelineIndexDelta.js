import { CRM_STATUSES } from './crm.js'
import { countDealsByStage } from '../dealPipeline.js'
import { entryLeadCity, entryLeadState } from './pipelineQuery.js'

function crmStatus(entry) {
  const st = entry?.crm?.status || 'new'
  return CRM_STATUSES.includes(st) ? st : 'new'
}

import { pipelineOwnerUserId } from '../pipelineOwner.js'

function entryOwner(entry) {
  return pipelineOwnerUserId(entry)
}

function emptyAssigneeBucket() {
  return {
    total: 0,
    byStatus: CRM_STATUSES.map((status) => ({ status, count: 0 })),
  }
}

function shiftOrgByStatus(byStatus, fromStatus, toStatus) {
  return byStatus.map((row) => {
    if (row.status === fromStatus) return { ...row, count: Math.max(0, row.count - 1) }
    if (row.status === toStatus) return { ...row, count: row.count + 1 }
    return { ...row }
  })
}

function decrementStatusInBucket(bucket, status) {
  const st = CRM_STATUSES.includes(status) ? status : 'new'
  return {
    ...bucket,
    byStatus: bucket.byStatus.map((row) =>
      row.status === st ? { ...row, count: Math.max(0, row.count - 1) } : { ...row }
    ),
  }
}

function incrementStatusInBucket(bucket, status) {
  const st = CRM_STATUSES.includes(status) ? status : 'new'
  return {
    ...bucket,
    byStatus: bucket.byStatus.map((row) =>
      row.status === st ? { ...row, count: row.count + 1 } : { ...row }
    ),
  }
}

function shiftStatusInBucket(bucket, fromStatus, toStatus) {
  let next = decrementStatusInBucket(bucket, fromStatus)
  next = incrementStatusInBucket(next, toStatus)
  return { total: bucket.total, byStatus: next.byStatus }
}

function moveAssigneeBetweenBuckets(byAssignee, prevOwner, nextOwner, prevStatus, nextStatus) {
  const next = { ...(byAssignee || {}) }

  if (prevOwner) {
    const prevKey = String(prevOwner)
    const bucket = next[prevKey]
    if (bucket) {
      const updated = decrementStatusInBucket(bucket, prevStatus)
      updated.total = Math.max(0, updated.total - 1)
      if (updated.total <= 0) delete next[prevKey]
      else next[prevKey] = updated
    }
  }

  if (nextOwner) {
    const nextKey = String(nextOwner)
    const bucket = next[nextKey] || emptyAssigneeBucket()
    const updated = incrementStatusInBucket(bucket, nextStatus)
    updated.total = bucket.total + 1
    next[nextKey] = updated
  }

  return next
}

function appendLocationFacet(list, value) {
  if (!value) return list || []
  const facets = list || []
  const norm = String(value).trim().toLowerCase()
  if (!norm) return facets
  if (facets.some((item) => String(item).trim().toLowerCase() === norm)) return facets
  return [...facets, String(value).trim()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
}

function mergeDealCountField(existing, prevEntry, nextEntry, options) {
  const prev = countDealsByStage([prevEntry], options)
  const next = countDealsByStage([nextEntry], options)
  const keys = new Set([...Object.keys(existing || {}), ...Object.keys(prev), ...Object.keys(next)])
  const out = {}
  for (const key of keys) {
    out[key] = Math.max(0, (existing?.[key] || 0) - (prev[key] || 0) + (next[key] || 0))
  }
  return out
}

/**
 * Apply a single-lead CRM patch to a precomputed pipeline index doc (O(1) vs full shard scan).
 * Returns null when incremental update is not possible (missing doc or entries).
 */
export function applyIncrementalPipelineIndex(doc, previousEntry, nextEntry, { freightOrg = false } = {}) {
  if (!doc || !previousEntry || !nextEntry) return null

  const prevStatus = crmStatus(previousEntry)
  const nextStatus = crmStatus(nextEntry)
  const prevOwner = entryOwner(previousEntry)
  const nextOwner = entryOwner(nextEntry)

  let byStatus = Array.isArray(doc.byStatus)
    ? doc.byStatus.map((row) => ({ ...row }))
    : CRM_STATUSES.map((status) => ({ status, count: 0 }))

  if (prevStatus !== nextStatus) {
    byStatus = shiftOrgByStatus(byStatus, prevStatus, nextStatus)
  }

  let byAssignee = { ...(doc.byAssignee || {}) }
  if (String(prevOwner || '') !== String(nextOwner || '')) {
    byAssignee = moveAssigneeBetweenBuckets(
      byAssignee,
      prevOwner,
      nextOwner,
      prevStatus,
      nextStatus
    )
  } else if (prevOwner && prevStatus !== nextStatus) {
    const key = String(prevOwner)
    const bucket = byAssignee[key]
    if (bucket) {
      byAssignee[key] = shiftStatusInBucket(bucket, prevStatus, nextStatus)
    }
  }

  const prevCity = entryLeadCity(previousEntry)
  const nextCity = entryLeadCity(nextEntry)
  const prevState = entryLeadState(previousEntry)
  const nextState = entryLeadState(nextEntry)

  let cities = doc.cities || []
  let states = doc.states || []
  if (nextCity && nextCity !== prevCity) cities = appendLocationFacet(cities, nextCity)
  if (nextState && nextState !== prevState) states = appendLocationFacet(states, nextState)

  const nextDoc = {
    ...doc,
    byStatus,
    byAssignee,
    cities,
    states,
    updatedAt: new Date().toISOString(),
  }

  if (freightOrg) {
    nextDoc.dealCounts = mergeDealCountField(doc.dealCounts, previousEntry, nextEntry, {
      openOnly: false,
      freightOrg: true,
    })
    nextDoc.openDealCounts = mergeDealCountField(doc.openDealCounts, previousEntry, nextEntry, {
      openOnly: true,
      freightOrg: true,
    })
  }

  return nextDoc
}
