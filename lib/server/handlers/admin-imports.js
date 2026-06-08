import { requireAdmin } from '../auth.js'
import {
  listAdminOverview,
  importRowsChunkIntoStore,
  dedupeMasterDatabase,
  MASTER_DATA_COLLECTIONS,
} from '../imports.js'
import { ensureBuiltInDatabase } from '../seed.js'
import { readStore, updateStorePartial } from '../store.js'
import { recordAdminAudit } from '../platformSupport.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

async function readMasterStore() {
  return readStore({ only: MASTER_DATA_COLLECTIONS })
}

async function updateMasterStore(mutator) {
  return updateStorePartial(MASTER_DATA_COLLECTIONS, mutator)
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireAdmin(req, res)
  if (!user) return

  if (req.method === 'GET') {
    await ensureBuiltInDatabase()
    const store = await readMasterStore()
    return sendJson(res, 200, listAdminOverview(store))
  }

  if (req.method === 'POST') {
    const body = getBody(req)

    if (body.action === 'dedupe') {
      let stats
      try {
        const store = await updateMasterStore((draft) => {
          stats = dedupeMasterDatabase(draft)
          recordAdminAudit(draft, {
            actorUserId: user.id,
            actorEmail: user.email,
            action: 'dedupe_master_database',
            targetType: 'master_data',
            targetId: 'companies_contacts',
            detail: stats,
          })
          return draft
        })
        return sendJson(res, 200, { ok: true, dedupe: stats, ...listAdminOverview(store) })
      } catch (error) {
        return sendJson(res, 400, { error: error.message || 'Dedupe failed' })
      }
    }

    const rows = Array.isArray(body.rows) ? body.rows : []
    const datasetType = body.datasetType || 'general'
    const importJobId = body.importJobId ? String(body.importJobId) : null
    const chunkIndex = Number(body.chunkIndex) || 0
    const isLast = body.done !== false

    if (!rows.length && !importJobId) {
      return sendJson(res, 400, { error: 'Upload rows are required' })
    }
    if (!rows.length && !isLast) {
      return sendJson(res, 400, { error: 'No rows in upload chunk' })
    }
    if (chunkIndex > 0 && !importJobId) {
      return sendJson(res, 400, { error: 'importJobId required for follow-up chunks' })
    }

    let importJob
    try {
      const store = await updateMasterStore((draft) => {
        const result = importRowsChunkIntoStore(draft, datasetType, rows, user, {
          importJobId,
          isFirst: !importJobId,
          isLast,
        })
        importJob = result.importJob
        return result.store
      })
      if (!isLast) {
        return sendJson(res, 200, {
          ok: true,
          importJobId: importJob.id,
          chunkIndex,
          progress: {
            rowCount: importJob.rowCount,
            companiesCreated: importJob.companiesCreated,
            contactsCreated: importJob.contactsCreated,
            contactsUpdated: importJob.contactsUpdated,
            rejectedRows: importJob.rejectedRows,
            status: importJob.status,
          },
        })
      }
      return sendJson(res, 200, {
        ok: true,
        importJob,
        ...listAdminOverview(store),
      })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Import failed' })
    }
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
