/** Platform operator (Connect Intel staff) panels — not for customer workspaces. */

import { isCustomerPanelAllowed } from '../../../lib/orgNavAccess.js'

export const PLATFORM_OPERATOR_PANELS = new Set([
  'admin-home',
  'admin',
  'admin-customers',
  'integrations',
])

export function isPlatformOperatorPanel(panel) {
  return PLATFORM_OPERATOR_PANELS.has(String(panel || '').trim())
}

export function resolvePanelForUser(panel, { isPlatformAdmin = false, user = null } = {}) {
  const id = String(panel || 'pipeline').trim() || 'pipeline'
  if (!isPlatformAdmin && isPlatformOperatorPanel(id)) return 'pipeline'
  if (!isCustomerPanelAllowed(user, id)) return 'pipeline'
  return id
}

export function sanitizeAppLocation(location, { isPlatformAdmin = false, user = null } = {}) {
  const base = location?.panel
    ? {
        panel: location.panel,
        panelOptions: location.panelOptions || {},
        leadId: location.leadId ?? null,
      }
    : { panel: 'pipeline', panelOptions: {}, leadId: null }

  const panel = resolvePanelForUser(base.panel, { isPlatformAdmin, user })
  if (panel === base.panel) return base
  return { panel, panelOptions: {}, leadId: null }
}
