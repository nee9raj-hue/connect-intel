import crypto from 'node:crypto'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { resolveOrganizationUuid } from './orgSqlResolve.js'
import { WORKFLOW_ENGINE_VERSION } from './workflowCatalog.js'

function flag(name) {
  const v = String(process.env[name] || '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function isWorkflowRunsEnabled() {
  if (flag('WORKFLOW_RUNS_OFF') || flag('DISABLE_WORKFLOW_RUNS')) return false
  return isSupabaseEnabled()
}

const orgUuidCache = { orgs: new Map() }

async function resolveOrgUuid(legacyOrgId, store) {
  if (!legacyOrgId) return null
  return resolveOrganizationUuid(legacyOrgId, orgUuidCache, { store, autoSync: false })
}

function hashDefinition(definition) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(definition || {}))
    .digest('hex')
    .slice(0, 24)
}

export function buildWorkflowIdempotencyKey({ triggerType, workflowKey, leadId, bucket = 'day' }) {
  const date = new Date().toISOString().slice(0, 10)
  const parts = [triggerType, workflowKey, leadId]
  if (bucket === 'day') parts.push(date)
  return parts.filter(Boolean).join(':')
}

function isMissingTableError(message) {
  return /relation.*workflow_|42P01|schema cache/i.test(String(message || ''))
}

export async function ensureWorkflowVersion({
  organizationId,
  workflowKey,
  workflowType,
  definition,
  store = null,
}) {
  if (!isWorkflowRunsEnabled() || !workflowKey || !workflowType) return null

  const orgUuid = await resolveOrgUuid(organizationId, store)
  const defHash = hashDefinition(definition)
  const engineVersion = WORKFLOW_ENGINE_VERSION

  try {
    const existingPath =
      `workflow_versions?legacy_org_id=eq.${encodeURIComponent(organizationId)}` +
      `&workflow_key=eq.${encodeURIComponent(workflowKey)}` +
      `&definition_hash=eq.${encodeURIComponent(defHash)}` +
      `&select=id,version&order=version.desc&limit=1`

    const existing = await supabaseRest(existingPath, {}, { timeoutMs: 10_000, attempts: 1 })
    if (Array.isArray(existing) && existing[0]?.id) return existing[0].id

    const latestPath =
      `workflow_versions?legacy_org_id=eq.${encodeURIComponent(organizationId)}` +
      `&workflow_key=eq.${encodeURIComponent(workflowKey)}` +
      `&select=version&order=version.desc&limit=1`
    const latest = await supabaseRest(latestPath, {}, { timeoutMs: 10_000, attempts: 1 })
    const nextVersion = (Array.isArray(latest) && latest[0]?.version ? Number(latest[0].version) : 0) + 1

    const row = {
      legacy_org_id: organizationId,
      organization_id: orgUuid,
      workflow_key: String(workflowKey).slice(0, 128),
      workflow_type: workflowType,
      version: nextVersion,
      definition: definition && typeof definition === 'object' ? definition : {},
      definition_hash: defHash,
      engine_version: engineVersion,
      created_at: new Date().toISOString(),
    }

    const inserted = await supabaseRest('workflow_versions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([row]),
    })
    return Array.isArray(inserted) && inserted[0]?.id ? inserted[0].id : null
  } catch (error) {
    if (isMissingTableError(error?.message)) return null
    console.warn('workflow_versions upsert:', error?.message || error)
    return null
  }
}

export async function startWorkflowRun({
  organizationId,
  workflowKey,
  workflowType,
  triggerType,
  leadId,
  definition = null,
  idempotencyKey = null,
  actorUserId = null,
  meta = {},
  store = null,
}) {
  if (!isWorkflowRunsEnabled() || !triggerType) return { skipped: true }

  const orgUuid = await resolveOrgUuid(organizationId, store)
  const versionId =
    definition && workflowKey && workflowType
      ? await ensureWorkflowVersion({ organizationId, workflowKey, workflowType, definition, store })
      : null

  const row = {
    legacy_org_id: organizationId || null,
    organization_id: orgUuid,
    workflow_version_id: versionId,
    workflow_key: workflowKey ? String(workflowKey).slice(0, 128) : null,
    workflow_type: workflowType || null,
    trigger_type: String(triggerType).slice(0, 64),
    lead_id: leadId ? String(leadId).slice(0, 128) : null,
    status: 'running',
    idempotency_key: idempotencyKey ? String(idempotencyKey).slice(0, 200) : null,
    actor_legacy_user_id: actorUserId || null,
    meta: meta && typeof meta === 'object' ? meta : {},
    started_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }

  try {
    const inserted = await supabaseRest('workflow_runs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([row]),
    })
    const run = Array.isArray(inserted) ? inserted[0] : null
    return { ok: true, runId: run?.id || null, duplicate: false }
  } catch (error) {
    if (isMissingTableError(error?.message)) return { skipped: true, reason: 'table_missing' }
    if (/duplicate key|23505/i.test(String(error?.message || '')) && idempotencyKey) {
      return { ok: true, duplicate: true }
    }
    console.warn('workflow_runs insert:', error?.message || error)
    return { ok: false, error: error?.message || String(error) }
  }
}

export async function finishWorkflowRun(runId, { status = 'completed', errorMessage = null } = {}) {
  if (!isWorkflowRunsEnabled() || !runId) return { skipped: true }

  const normalized =
    status === 'failed' ? 'failed' : status === 'skipped' ? 'skipped' : 'completed'

  try {
    await supabaseRest(`workflow_runs?id=eq.${encodeURIComponent(runId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: normalized,
        error_message: errorMessage ? String(errorMessage).slice(0, 500) : null,
        completed_at: new Date().toISOString(),
      }),
    })
    return { ok: true }
  } catch (error) {
    if (isMissingTableError(error?.message)) return { skipped: true, reason: 'table_missing' }
    console.warn('workflow_runs finish:', error?.message || error)
    return { ok: false, error: error?.message || String(error) }
  }
}

export async function listWorkflowRunsForOrg(
  legacyOrgId,
  { limit = 50, triggerType = null, leadId = null } = {}
) {
  if (!isWorkflowRunsEnabled() || !legacyOrgId) return []

  const orgUuid = await resolveOrgUuid(legacyOrgId)
  const cap = Math.min(200, Math.max(1, Number(limit) || 50))

  let path =
    `workflow_runs?legacy_org_id=eq.${encodeURIComponent(legacyOrgId)}` +
    `&select=id,workflow_key,workflow_type,trigger_type,lead_id,status,meta,error_message,created_at,completed_at` +
    `&order=created_at.desc&limit=${cap}`

  if (orgUuid) {
    path =
      `workflow_runs?or=(legacy_org_id.eq.${encodeURIComponent(legacyOrgId)},organization_id.eq.${encodeURIComponent(orgUuid)})` +
      `&select=id,workflow_key,workflow_type,trigger_type,lead_id,status,meta,error_message,created_at,completed_at` +
      `&order=created_at.desc&limit=${cap}`
  }

  if (triggerType) path += `&trigger_type=eq.${encodeURIComponent(triggerType)}`
  if (leadId) path += `&lead_id=eq.${encodeURIComponent(leadId)}`

  try {
    const rows = await supabaseRest(path, {}, { timeoutMs: 12_000, attempts: 1 })
    return Array.isArray(rows) ? rows : []
  } catch (error) {
    if (isMissingTableError(error?.message)) return []
    throw error
  }
}
