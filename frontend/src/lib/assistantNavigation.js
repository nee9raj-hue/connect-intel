import { navTargetToOptions } from './navConfig'

/** Apply a server-suggested assistant action in the app shell. */
export function applyAssistantAction(action, { navigate, openPipelineLead }) {
  if (!action || typeof action !== 'object') return false

  if (action.type === 'escalate') return false

  if (action.type === 'open_url' && action.url) {
    window.open(action.url, '_blank', 'noopener,noreferrer')
    return true
  }

  if (action.type === 'navigate' && action.panel && navigate) {
    const options = navTargetToOptions(action)
    if (action.tab) options.tab = action.tab
    navigate(action.panel, options)
    if (action.leadId && openPipelineLead) {
      openPipelineLead(action.leadId, action.leadTab || 'overview')
    }
    return true
  }

  return false
}
