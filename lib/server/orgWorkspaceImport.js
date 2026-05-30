import { createId } from './store.js'
import { capWorkspaceRows, filterNonemptyRows } from '../workspaceAnalytics.js'

export const WORKSPACE_STORE_COLLECTIONS = ['organizations', 'orgWorkspaceImports', 'activeTradingImports']

export function listOrgWorkspaceImports(store, organizationId) {
  return (store.orgWorkspaceImports || []).filter((r) => r.organizationId === organizationId)
}

export function findWorkspaceImport(store, importId) {
  if (!importId) return null
  return (store.orgWorkspaceImports || []).find((r) => r.id === importId) || null
}

export function getLatestWorkspaceImport(store, org) {
  const analytics = org?.workspaceAnalytics
  if (analytics?.latestImportId) {
    return findWorkspaceImport(store, analytics.latestImportId)
  }
  const legacy = analytics?.latestImport
  if (legacy?.rows?.length) {
    return {
      id: legacy.id || `legacy-${org.id}`,
      organizationId: org.id,
      fileName: legacy.fileName,
      uploadedAt: legacy.uploadedAt,
      rowCount: legacy.rowCount,
      totalRows: legacy.totalRows,
      truncated: legacy.truncated,
      columns: legacy.columns,
      rows: legacy.rows,
      status: 'complete',
      legacyEmbedded: true,
    }
  }
  return null
}

export function getPendingWorkspaceImport(store, organizationId, uploadId) {
  const list = listOrgWorkspaceImports(store, organizationId)
  if (uploadId) return list.find((r) => r.id === uploadId && r.status === 'pending') || null
  return list.find((r) => r.status === 'pending') || null
}

export function publicImportMeta(record) {
  if (!record) return null
  return {
    id: record.id,
    fileName: record.fileName,
    uploadedAt: record.uploadedAt,
    rowCount: record.rowCount ?? record.rows?.length ?? 0,
    totalRows: record.totalRows,
    truncated: record.truncated,
    columns: record.columns || [],
  }
}

export function pruneOrgWorkspaceImports(store, organizationId, keepImportId) {
  store.orgWorkspaceImports = (store.orgWorkspaceImports || []).filter(
    (r) => r.organizationId !== organizationId || r.id === keepImportId
  )
}

export function createPendingImport(store, { organizationId, uploadId, fileName, columns, totalRowsInFile, truncatedInFile, userId }) {
  if (!store.orgWorkspaceImports) store.orgWorkspaceImports = []
  pruneOrgWorkspaceImports(store, organizationId, null)
  store.orgWorkspaceImports = store.orgWorkspaceImports.filter(
    (r) => !(r.organizationId === organizationId && r.status === 'pending')
  )
  const record = {
    id: uploadId || createId('ws'),
    organizationId,
    status: 'pending',
    fileName,
    columns: Array.isArray(columns) ? columns.map(String) : [],
    rows: [],
    totalRowsInFile: Number(totalRowsInFile) || 0,
    truncatedInFile: Boolean(truncatedInFile),
    uploadedByUserId: userId,
    startedAt: new Date().toISOString(),
  }
  store.orgWorkspaceImports.push(record)
  return record
}

export function appendImportRows(record, rowsIn) {
  const room = Math.max(0, 5000 - (record.rows?.length || 0))
  if (!record.rows) record.rows = []
  record.rows.push(...rowsIn.slice(0, room))
}

export function finalizeWorkspaceImport(record) {
  const cleaned = filterNonemptyRows(record.rows || [])
  const { rows, truncated, total } = capWorkspaceRows(cleaned)
  if (!rows.length) throw new Error('No rows in upload')
  record.rows = rows
  record.rowCount = rows.length
  record.totalRows = record.totalRowsInFile || total
  record.truncated = truncated || record.truncatedInFile
  record.status = 'complete'
  record.uploadedAt = new Date().toISOString()
  delete record.startedAt
  return record
}
