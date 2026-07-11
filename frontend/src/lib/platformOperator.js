/** Platform operator (Connect Intel staff) panels — not for customer workspaces. */

export const PLATFORM_OPERATOR_PANELS = new Set([
  'admin-home',
  'admin',
  'admin-customers',
  'integrations',
])

export function isPlatformOperatorPanel(panel) {
  return PLATFORM_OPERATOR_PANELS.has(String(panel || '').trim())
}

export function resolvePanelForUser(panel, { isPlatformAdmin = false } = {}) {
  const id = String(panel || 'overview').trim() || 'overview'
  if (!isPlatformAdmin && isPlatformOperatorPanel(id)) return 'overview'
  return id
}

export function sanitizeAppLocation(location, { isPlatformAdmin = false } = {}) {
  const base = location?.panel
    ? {
        panel: location.panel,
        panelOptions: location.panelOptions || {},
        leadId: location.leadId ?? null,
      }
    : { panel: 'overview', panelOptions: {}, leadId: null }

  const panel = resolvePanelForUser(base.panel, { isPlatformAdmin })
  if (panel === base.panel) return base
  return { panel, panelOptions: {}, leadId: null }
}
