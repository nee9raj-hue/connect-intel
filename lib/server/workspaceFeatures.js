import {
  WORKSPACE_PRESETS,
  WORKSPACE_FEATURE_KEYS,
  inferWorkspacePreset,
  listWorkspaceFeatureDefinitions,
  listWorkspacePresetOptions,
  resolveWorkspaceFeatures,
} from '../workspaceFeatures.js'
import { getOrganization } from './organizations.js'

export {
  WORKSPACE_PRESETS,
  WORKSPACE_FEATURE_KEYS,
  inferWorkspacePreset,
  listWorkspaceFeatureDefinitions,
  listWorkspacePresetOptions,
  resolveWorkspaceFeatures,
  workspaceFeatureEnabled,
} from '../workspaceFeatures.js'

export function resolveOrgWorkspaceFeatures(store, org) {
  if (!org) return resolveWorkspaceFeatures({ workspacePreset: 'general_crm' })
  const imports = (store.activeTradingImports || []).filter((r) => r.organizationId === org.id)
  return resolveWorkspaceFeatures({ ...org, activeTradingImports: imports })
}

export function buildWorkspaceSettingsPayload(store, org) {
  const resolved = resolveOrgWorkspaceFeatures(store, org)
  return {
    preset: resolved.presetId,
    presetLabel: resolved.presetLabel,
    presetOptions: listWorkspacePresetOptions(),
    featureDefinitions: listWorkspaceFeatureDefinitions(),
    features: resolved.features,
    overrides: resolved.overrides,
  }
}

export function updateOrganizationWorkspace(store, organizationId, { workspacePreset, workspaceFeatures } = {}) {
  const org = getOrganization(store, organizationId)
  if (!org) throw new Error('Organization not found')

  if (workspacePreset !== undefined) {
    const id = String(workspacePreset || '').trim()
    if (id && !WORKSPACE_PRESETS[id]) {
      throw new Error('Invalid workspace preset')
    }
    org.workspacePreset = id || inferWorkspacePreset(org)
  }

  if (workspaceFeatures !== undefined) {
    const next = { ...(org.workspaceFeatures || {}) }
    const patch = workspaceFeatures && typeof workspaceFeatures === 'object' ? workspaceFeatures : {}
    for (const key of WORKSPACE_FEATURE_KEYS) {
      if (patch[key] === undefined) continue
      if (patch[key] === null) {
        delete next[key]
      } else if (typeof patch[key] === 'boolean') {
        next[key] = patch[key]
      }
    }
    org.workspaceFeatures = next
  }

  return org
}
