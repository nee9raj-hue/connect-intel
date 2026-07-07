/**
 * Response Validator — self-check before showing answers to the user.
 */

import { isPollutedDiscoveryResult } from './queryUnderstanding.js'

export function validateCopilotResponse(result, plan, understanding, state) {
  const issues = []

  if (!result) {
    issues.push('empty_result')
    return { valid: false, issues }
  }

  if (understanding?.intent === 'knowledge_lookup') {
    if (result.source === 'discovery' || plan?.runLeadDiscovery) {
      issues.push('wrong_pipeline_used_lead_discovery_instead_of_knowledge')
    }
    if (understanding.entityType === 'TV_SHOW' && plan?.runLeadDiscovery) {
      issues.push('tv_show_routed_to_lead_discovery')
    }
  }

  if (understanding?.entity && result.reply) {
    const pollutedInReply = /\bshark\s+exports?\b/i.test(result.reply) && !/shark\s+tank/i.test(result.reply)
    if (pollutedInReply) issues.push('polluted_shark_exports_in_reply')
  }

  if (state?.knowledgeContext?.entity && understanding?.followUp) {
    if (result.reply?.match(/\bwhich\s+(contest|show|company)\b/i)) {
      issues.push('unnecessary_clarification_despite_context')
    }
  }

  for (const c of result.companies || []) {
    if (isPollutedDiscoveryResult(c, understanding)) {
      issues.push(`polluted_company:${c.company || c.name}`)
    }
  }

  if (understanding?.mode === 'knowledge_lookup' && !understanding?.semanticQuery) {
    issues.push('missing_semantic_query')
  }

  return { valid: issues.length === 0, issues }
}

export function filterValidatedCompanies(companies, understanding) {
  return (companies || []).filter((c) => !isPollutedDiscoveryResult(c, understanding))
}
