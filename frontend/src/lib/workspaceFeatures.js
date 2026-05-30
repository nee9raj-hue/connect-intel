import {
  COMPANY_WORKSPACE_GLOBALLY_ENABLED,
  resolveWorkspaceFeatures,
  WORKSPACE_FEATURE_KEYS,
  WORKSPACE_PRESETS,
  listWorkspacePresetOptions,
  listWorkspaceFeatureDefinitions,
  workspaceFeatureEnabled,
} from '../../../lib/workspaceFeatures.js'

export {
  COMPANY_WORKSPACE_GLOBALLY_ENABLED,
  WORKSPACE_FEATURE_KEYS,
  WORKSPACE_PRESETS,
  listWorkspacePresetOptions,
  listWorkspaceFeatureDefinitions,
  resolveWorkspaceFeatures,
  workspaceFeatureEnabled,
}

/** Resolved feature map for the signed-in user (from session). */
export function getWorkspaceFeaturesFromUser(user) {
  if (user?.workspaceFeatures && typeof user.workspaceFeatures === 'object') {
    return user.workspaceFeatures
  }
  return resolveWorkspaceFeatures({ workspacePreset: 'general_crm' }).features
}

export function hasWorkspaceFeature(user, key) {
  return Boolean(getWorkspaceFeaturesFromUser(user)[key])
}
