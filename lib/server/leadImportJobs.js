import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { resolveOrgUuid, resolveProfileId } from './enterpriseLeadsTable.js'

const cache = { orgs: new Map(), profiles: new Map() }

export async function createLeadImportJob(legacyOrgId, actor, { filename, totalRows = 0 } = {}) {
  if (!isSupabaseEnabled()) return null

  const orgUuid = await resolveOrgUuid(legacyOrgId, cache)
  if (!orgUuid) return null

  const profileId = actor?.id ? await resolveProfileId(actor.id, cache) : null

  const rows = await supabaseRest(
    'lead_imports',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        organization_id: orgUuid,
        imported_by_profile_id: profileId,
        imported_by_legacy_user_id: actor?.id || null,
        filename: filename || 'import.csv',
        status: 'processing',
        total_rows: totalRows,
      }),
    },
    { timeoutMs: 12_000 }
  )

  return Array.isArray(rows) ? rows[0] : rows
}

export async function completeLeadImportJob(jobId, legacyOrgId, stats = {}) {
  if (!jobId || !isSupabaseEnabled()) return

  const orgUuid = await resolveOrgUuid(legacyOrgId, cache)
  if (!orgUuid) return

  await supabaseRest(
    `lead_imports?id=eq.${encodeURIComponent(jobId)}&organization_id=eq.${encodeURIComponent(orgUuid)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: stats.failed ? 'failed' : 'completed',
        created_count: stats.created || 0,
        updated_count: stats.updated || 0,
        skipped_count: stats.skipped || 0,
        error_count: stats.errors || 0,
        error_message: stats.errorMessage || null,
        completed_at: new Date().toISOString(),
      }),
    },
    { timeoutMs: 12_000 }
  )
}

export async function getLeadImportJob(jobId, legacyOrgId) {
  if (!jobId || !isSupabaseEnabled()) return null

  const orgUuid = await resolveOrgUuid(legacyOrgId, cache)
  if (!orgUuid) return null

  const rows = await supabaseRest(
    `lead_imports?id=eq.${encodeURIComponent(jobId)}&organization_id=eq.${encodeURIComponent(orgUuid)}&limit=1`,
    {},
    { timeoutMs: 10_000 }
  )

  const row = Array.isArray(rows) ? rows[0] : null
  if (!row) return null

  return {
    id: row.id,
    status: row.status,
    filename: row.filename,
    totalRows: row.total_rows,
    createdCount: row.created_count,
    updatedCount: row.updated_count,
    skippedCount: row.skipped_count,
    errorCount: row.error_count,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }
}
