import { requireUser, refreshSessionCookie } from '../auth.js'
import { buildOrgUserResponse, getOrganization } from '../organizations.js'
import { readStore, updateStorePartial } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { COMPANY_WORKSPACE_GLOBALLY_ENABLED } from '../../workspaceFeatures.js'
import { resolveOrgWorkspaceFeatures, workspaceFeatureEnabled } from '../workspaceFeatures.js'
import {
  buildWorkspaceReport,
  sampleRowsForAi,
  WORKSPACE_QUESTION_CATALOG,
} from '../../workspaceAnalytics.js'
import { analyzeWorkspaceUpload } from '../perplexity.js'
import {
  appendImportRows,
  createPendingImport,
  finalizeWorkspaceImport,
  getLatestWorkspaceImport,
  getPendingWorkspaceImport,
  publicImportMeta,
  pruneOrgWorkspaceImports,
  WORKSPACE_STORE_COLLECTIONS,
} from '../orgWorkspaceImport.js'

const PATCH_COLLECTIONS = [...WORKSPACE_STORE_COLLECTIONS, 'users']

function defaultAnalytics(org) {
  return {
    industry: 'logistics_trading',
    pageTitle: org?.workspacePageTitle || (org?.name ? `${org.name} Workspace` : 'Company Workspace'),
    latestImport: null,
    sheetInsights: null,
    goals: { selectedQuestionIds: [], customNotes: '' },
    report: null,
    updatedAt: null,
  }
}

function getAnalytics(org, importRecord = null) {
  const base = defaultAnalytics(org)
  const stored = org?.workspaceAnalytics
  if (!stored || typeof stored !== 'object') {
    if (importRecord) base.latestImport = publicImportMeta(importRecord)
    return base
  }
  const merged = {
    ...base,
    ...stored,
    goals: { ...base.goals, ...(stored.goals || {}) },
    latestImport: publicImportMeta(importRecord),
    pendingUpload: undefined,
  }
  delete merged.latestImportId
  return merged
}

function attachLegacyImportId(org) {
  const analytics = org?.workspaceAnalytics
  if (!analytics || analytics.latestImportId) return
  const legacy = analytics.latestImport
  if (!legacy?.rows?.length) return
  analytics.latestImportId = legacy.id || `legacy-${org.id}`
}

async function readWorkspaceStore(extra = []) {
  return readStore({ only: [...new Set([...WORKSPACE_STORE_COLLECTIONS, ...extra])] })
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.organizationId || user.accountType !== 'company') {
    return sendJson(res, 403, { error: 'Company workspace is for company accounts only' })
  }

  if (!COMPANY_WORKSPACE_GLOBALLY_ENABLED) {
    return sendJson(res, 403, {
      error: 'Company workspace is temporarily unavailable.',
      paused: true,
    })
  }

  const store = await readWorkspaceStore()
  const org = getOrganization(store, user.organizationId)
  if (!org) return sendJson(res, 404, { error: 'Organization not found' })

  attachLegacyImportId(org)
  const latestImport = getLatestWorkspaceImport(store, org)

  const workspace = resolveOrgWorkspaceFeatures(store, org)
  if (!workspaceFeatureEnabled(workspace, 'companyWorkspacePage')) {
    return sendJson(res, 403, {
      error: 'Company workspace is not enabled. Turn it on under Team → Workspace modules.',
    })
  }

  if (req.method === 'GET') {
    const analytics = getAnalytics(org, latestImport)
    return sendJson(res, 200, {
      pageTitle: analytics.pageTitle,
      industry: analytics.industry,
      analytics,
      questionCatalog: WORKSPACE_QUESTION_CATALOG,
      hasImport: Boolean(latestImport?.rows?.length),
      crmSeparate: true,
    })
  }

  if (!user.isOrgAdmin) {
    return sendJson(res, 403, { error: 'Only company admins can configure the company workspace' })
  }

  const body = getBody(req)
  const action = body.action || (req.method === 'POST' ? 'upload' : '')

  try {
    if (req.method === 'PATCH') {
      await updateStorePartial(PATCH_COLLECTIONS, (draft) => {
        const o = getOrganization(draft, user.organizationId)
        if (!o) throw new Error('Organization not found')
        if (body.pageTitle !== undefined) {
          o.workspacePageTitle = String(body.pageTitle || '').trim().slice(0, 80) || null
        }
        if (body.industry !== undefined) {
          o.workspaceAnalytics = o.workspaceAnalytics || {}
          o.workspaceAnalytics.industry = String(body.industry || 'logistics_trading')
          o.workspaceAnalytics.updatedAt = new Date().toISOString()
        }
        if (body.goals !== undefined) {
          const record = getLatestWorkspaceImport(draft, o)
          const current = getAnalytics(o, record)
          const goals = body.goals && typeof body.goals === 'object' ? body.goals : {}
          current.goals = {
            selectedQuestionIds: Array.isArray(goals.selectedQuestionIds)
              ? goals.selectedQuestionIds
              : current.goals.selectedQuestionIds,
            customNotes:
              goals.customNotes !== undefined ? String(goals.customNotes || '') : current.goals.customNotes,
          }
          const rows = record?.rows || []
          const mapping = o.workspaceAnalytics?.sheetInsights?.columnMapping || {}
          current.report = rows.length ? buildWorkspaceReport(rows, current.goals, mapping) : null
          current.updatedAt = new Date().toISOString()
          o.workspaceAnalytics = {
            ...(o.workspaceAnalytics || {}),
            industry: current.industry,
            sheetInsights: current.sheetInsights,
            goals: current.goals,
            report: current.report,
            updatedAt: current.updatedAt,
            latestImportId: o.workspaceAnalytics?.latestImportId || record?.id,
          }
          delete o.workspaceAnalytics.latestImport
        }
        return draft
      })

      const after = await readWorkspaceStore(['users'])
      const refreshedOrg = getOrganization(after, user.organizationId)
      const refreshedUser = buildOrgUserResponse(
        after.users.find((u) => u.id === user.id),
        after
      )
      await refreshSessionCookie(res, refreshedUser)
      const importRecord = getLatestWorkspaceImport(after, refreshedOrg)
      return sendJson(res, 200, {
        user: refreshedUser,
        analytics: getAnalytics(refreshedOrg, importRecord),
      })
    }

    if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'PATCH', 'POST'])

    if (action === 'analyze') {
      const record = latestImport
      const rows = record?.rows || []
      if (!rows.length) return sendJson(res, 400, { error: 'Upload a file first' })

      const industry = org.workspaceAnalytics?.industry || 'logistics_trading'
      const insights = await analyzeWorkspaceUpload({
        industry,
        columns: record.columns || [],
        sampleRows: sampleRowsForAi(rows),
        rowCount: rows.length,
      })

      await updateStorePartial(WORKSPACE_STORE_COLLECTIONS, (draft) => {
        const o = getOrganization(draft, user.organizationId)
        o.workspaceAnalytics = {
          ...(o.workspaceAnalytics || {}),
          sheetInsights: insights,
          updatedAt: new Date().toISOString(),
          latestImportId: record.id,
        }
        delete o.workspaceAnalytics.latestImport
        if (record.legacyEmbedded) {
          migrateLegacyImportToCollection(draft, o, record)
        }
        return draft
      })

      const after = await readWorkspaceStore()
      const refreshedOrg = getOrganization(after, user.organizationId)
      return sendJson(res, 200, {
        sheetInsights: getAnalytics(refreshedOrg, getLatestWorkspaceImport(after, refreshedOrg)).sheetInsights,
      })
    }

    if (action === 'upload' || action === 'uploadChunk') {
      const uploadId = String(body.uploadId || '').slice(0, 64)
      const chunkIndex = Number(body.chunkIndex) || 0
      const isLast = Boolean(body.done)
      const rowsIn = Array.isArray(body.rows) ? body.rows : []
      if (!rowsIn.length && !isLast) {
        return sendJson(res, 400, { error: 'No rows in upload chunk' })
      }

      const fileName = String(body.fileName || 'upload.csv').slice(0, 200)
      let finalizeMessage = null
      let finishedImportId = null

      await updateStorePartial(WORKSPACE_STORE_COLLECTIONS, (draft) => {
        const o = getOrganization(draft, user.organizationId)
        if (!o) throw new Error('Organization not found')
        if (!draft.orgWorkspaceImports) draft.orgWorkspaceImports = []

        let pending =
          chunkIndex === 0
            ? createPendingImport(draft, {
                organizationId: user.organizationId,
                uploadId,
                fileName,
                columns: body.columns,
                totalRowsInFile: body.totalRowsInFile,
                truncatedInFile: body.truncatedInFile,
                userId: user.id,
              })
            : getPendingWorkspaceImport(draft, user.organizationId, uploadId)

        if (!pending) throw new Error('Upload session expired — please try again')
        if (uploadId && pending.id !== uploadId) {
          throw new Error('Upload session mismatch — please try again')
        }

        if (rowsIn.length) appendImportRows(pending, rowsIn)

        if (!isLast) return draft

        finalizeWorkspaceImport(pending)
        finishedImportId = pending.id
        pruneOrgWorkspaceImports(draft, user.organizationId, pending.id)

        o.workspaceAnalytics = {
          ...(o.workspaceAnalytics || {}),
          latestImportId: pending.id,
          sheetInsights: null,
          report: null,
          goals: { selectedQuestionIds: [], customNotes: '' },
          updatedAt: new Date().toISOString(),
        }
        delete o.workspaceAnalytics.latestImport
        delete o.workspaceAnalytics.pendingUpload

        finalizeMessage = pending.truncated
          ? `Stored first ${pending.rowCount} of ${pending.totalRows} rows for workspace analytics.`
          : `Stored ${pending.rowCount} rows for workspace analytics. CRM records were not changed.`
        return draft
      })

      if (!isLast) {
        return sendJson(res, 200, { ok: true, chunkIndex, uploadId: uploadId || finishedImportId })
      }

      const after = await readWorkspaceStore()
      const refreshedOrg = getOrganization(after, user.organizationId)
      const importRecord = getLatestWorkspaceImport(after, refreshedOrg)
      return sendJson(res, 200, {
        analytics: getAnalytics(refreshedOrg, importRecord),
        message: finalizeMessage,
      })
    }

    return sendJson(res, 400, { error: 'Unknown action' })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Request failed' })
  }
}

function migrateLegacyImportToCollection(store, org, legacyRecord) {
  if (!legacyRecord?.legacyEmbedded || !legacyRecord.rows?.length) return
  if (!store.orgWorkspaceImports) store.orgWorkspaceImports = []
  const existing = findImportInStore(store, legacyRecord.id)
  if (!existing) {
    store.orgWorkspaceImports.push({
      id: legacyRecord.id,
      organizationId: org.id,
      status: 'complete',
      fileName: legacyRecord.fileName,
      columns: legacyRecord.columns,
      rows: legacyRecord.rows,
      rowCount: legacyRecord.rowCount,
      totalRows: legacyRecord.totalRows,
      truncated: legacyRecord.truncated,
      uploadedAt: legacyRecord.uploadedAt,
    })
  }
}

function findImportInStore(store, id) {
  return (store.orgWorkspaceImports || []).find((r) => r.id === id) || null
}

