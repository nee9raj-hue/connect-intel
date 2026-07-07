/** Re-exports — lead discovery lives in leadDiscoveryAgent.js */
export { runLeadDiscoveryAgent, runLeadDiscoveryAgent as processLeadGenerationReply } from './leadDiscoveryAgent.js'

export function extractLeadGenQuery(message) {
  const text = String(message || '').trim()
  const quoted = text.match(/["']([^"']+)["']/)
  if (quoted) return quoted[1].trim()
  return text.slice(0, 140)
}
