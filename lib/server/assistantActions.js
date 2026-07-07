import { ASSISTANT_NAV_PANELS } from '../assistantKnowledge.js'
import { sanitizeCreateLeadPayload } from './copilot/actions.js'

const ALLOWED_NAV_KEYS = new Set([
  'panel',
  'tab',
  'status',
  'upcomingOnly',
  'leadId',
  'leadTab',
  'label',
])

export function sanitizeAssistantActions(actions = []) {
  if (!Array.isArray(actions)) return []
  const out = []
  for (const raw of actions.slice(0, 5)) {
    if (!raw || typeof raw !== 'object') continue
    if (raw.type === 'open_url' && typeof raw.url === 'string' && /^https:\/\//i.test(raw.url)) {
      out.push({
        type: 'open_url',
        url: raw.url,
        label: String(raw.label || 'Open link').slice(0, 80),
      })
      continue
    }
    if (raw.type === 'escalate') {
      out.push({
        type: 'escalate',
        label: String(raw.label || 'Raise support ticket').slice(0, 80),
      })
      continue
    }
    if (raw.type === 'create_lead') {
      const payload = sanitizeCreateLeadPayload(raw.payload || {})
      if (payload.company || payload.firstName || payload.lastName) {
        out.push({
          type: 'create_lead',
          label: String(raw.label || 'Create lead').slice(0, 80),
          payload,
        })
      }
      continue
    }
    if (raw.type !== 'navigate') continue
    const panel = String(raw.panel || '').trim()
    if (!ASSISTANT_NAV_PANELS.has(panel)) continue
    const action = { type: 'navigate', panel, label: String(raw.label || 'Open').slice(0, 80) }
    for (const key of ALLOWED_NAV_KEYS) {
      if (key === 'panel' || key === 'label') continue
      if (raw[key] != null && raw[key] !== '') action[key] = raw[key]
    }
    out.push(action)
  }
  return out
}
