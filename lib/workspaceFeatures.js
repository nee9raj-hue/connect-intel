/**
 * Per-organization workspace modules — keeps core CRM universal;
 * industry-specific surfaces (shipments, active customers, etc.) are opt-in.
 */

/** Set true when company workspace (upload + AI reports) is ready for customers. */
export const COMPANY_WORKSPACE_GLOBALLY_ENABLED = false

export const WORKSPACE_FEATURE_KEYS = [
  'companyWorkspacePage',
  'dashboardTeamIntelligence',
  'panelActiveCustomers',
  'homeTeamMetrics',
  'activeTradingImport',
]

export const WORKSPACE_PRESETS = {
  general_crm: {
    id: 'general_crm',
    label: 'General CRM',
    description:
      'Pipeline, contacts, email, calendar, and marketing. No logistics or shipment-specific screens.',
    features: {
      companyWorkspacePage: false,
      dashboardTeamIntelligence: false,
      panelActiveCustomers: false,
      homeTeamMetrics: true,
      activeTradingImport: false,
    },
  },
  logistics_trading: {
    id: 'logistics_trading',
    label: 'Logistics & shipping',
    description: 'CRM tuned for logistics teams. Shipment and trading tools can be enabled below.',
    features: {
      companyWorkspacePage: false,
      dashboardTeamIntelligence: false,
      panelActiveCustomers: false,
      homeTeamMetrics: true,
      activeTradingImport: false,
    },
  },
  ecommerce_retail: {
    id: 'ecommerce_retail',
    label: 'E-commerce & retail',
    description: 'Standard CRM for stores and brands — no shipment tracking panels.',
    features: {
      dashboardTeamIntelligence: false,
      panelActiveCustomers: false,
      homeTeamMetrics: true,
      activeTradingImport: false,
    },
  },
  healthcare_services: {
    id: 'healthcare_services',
    label: 'Healthcare & services',
    description: 'Relationship CRM for clinics and service teams — core modules only.',
    features: {
      dashboardTeamIntelligence: false,
      panelActiveCustomers: false,
      homeTeamMetrics: true,
      activeTradingImport: false,
    },
  },
  manufacturing: {
    id: 'manufacturing',
    label: 'Manufacturing',
    description: 'Pipeline and accounts; optional trading tools can be turned on in settings.',
    features: {
      dashboardTeamIntelligence: false,
      panelActiveCustomers: false,
      homeTeamMetrics: true,
      activeTradingImport: false,
    },
  },
}

export function listWorkspacePresetOptions() {
  return Object.values(WORKSPACE_PRESETS).map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
  }))
}

export function listWorkspaceFeatureDefinitions() {
  const all = [
    {
      key: 'companyWorkspacePage',
      label: 'Company workspace page',
      description:
        'Dedicated page (e.g. “Xindus Workspace”) with upload + AI reports. Does not change CRM records.',
      group: 'Workspace',
    },
    {
      key: 'dashboardTeamIntelligence',
      label: 'Trading dashboard block',
      description: 'Shipments, churn preview, and trading stats on the home dashboard.',
      group: 'Dashboard',
    },
    {
      key: 'panelActiveCustomers',
      label: 'Active customers',
      description: 'Sidebar page and imports matched by mobile for shipment history.',
      group: 'CRM',
    },
    {
      key: 'homeTeamMetrics',
      label: 'Team metrics page',
      description: 'Full team performance dashboard (activities, funnel, members).',
      group: 'Dashboard',
    },
    {
      key: 'activeTradingImport',
      label: 'Shipment file import',
      description: 'Upload CSV/Excel to update trading profiles on leads (Team settings).',
      group: 'Data',
    },
  ]
  if (!COMPANY_WORKSPACE_GLOBALLY_ENABLED) {
    return all.filter((def) => def.key !== 'companyWorkspacePage')
  }
  return all
}

function normalizeOverrides(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  for (const key of WORKSPACE_FEATURE_KEYS) {
    const v = raw[key]
    if (typeof v === 'boolean') out[key] = v
    else if (v && typeof v === 'object' && typeof v.enabled === 'boolean') out[key] = v.enabled
  }
  return out
}

/** Existing orgs with shipment imports keep logistics preset unless admin changes it. */
export function inferWorkspacePreset(org) {
  if (org?.workspacePreset && WORKSPACE_PRESETS[org.workspacePreset]) {
    return org.workspacePreset
  }
  const imports = Array.isArray(org?.activeTradingImports) ? org.activeTradingImports : []
  if (imports.length > 0) return 'logistics_trading'
  return 'general_crm'
}

export function resolveWorkspaceFeatures(org) {
  const presetId = inferWorkspacePreset(org)
  const preset = WORKSPACE_PRESETS[presetId] || WORKSPACE_PRESETS.general_crm
  const overrides = normalizeOverrides(org?.workspaceFeatures)
  const features = { ...preset.features }
  for (const key of WORKSPACE_FEATURE_KEYS) {
    if (overrides[key] !== undefined) features[key] = overrides[key]
  }
  if (!COMPANY_WORKSPACE_GLOBALLY_ENABLED) {
    features.companyWorkspacePage = false
  }
  return {
    presetId,
    presetLabel: preset.label,
    presetDescription: preset.description,
    features,
    overrides,
  }
}

export function workspaceFeatureEnabled(orgOrResolved, key) {
  if (!key) return true
  if (key === 'companyWorkspacePage' && !COMPANY_WORKSPACE_GLOBALLY_ENABLED) return false
  const features =
    orgOrResolved?.features ||
    orgOrResolved?.workspaceFeatures ||
    resolveWorkspaceFeatures(orgOrResolved).features
  return Boolean(features[key])
}
