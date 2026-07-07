/**
 * Entity extraction — understand WHO/WHAT/WHERE before any search.
 */

import { parseSearchQueryFallback } from '../searchQueryParser.js'

const ROLE_RE =
  /\b(founder|co-?founder|ceo|cfo|cto|director|managing director|md|vp|head of|owner|proprietor|decision.?maker|export manager|procurement)\b/i

const COMPANY_PATTERNS = [
  /\b(?:founder|ceo|director|head)\s+(?:of|at)\s+([A-Za-z0-9][A-Za-z0-9\s&.'-]{2,60}?)(?:\s+from|\s+in|\s*$)/i,
  /\b(?:at|for|of)\s+([A-Za-z0-9][A-Za-z0-9\s&.'-]{2,60}?)(?:\s+from|\s+in\s+[A-Za-z]|\s*$)/i,
  /\b([A-Za-z0-9][A-Za-z0-9\s&.'-]{2,50}?)\s+(?:pvt|ltd|limited|llp|inc|exports?|industries|toys)\b/i,
]

export function extractEntities(message) {
  const text = String(message || '').trim()
  const lower = text.toLowerCase()
  const parsed = parseSearchQueryFallback(text)

  let company = parsed.targetCompany || ''
  for (const re of COMPANY_PATTERNS) {
    const m = text.match(re)
    if (m?.[1]) {
      const candidate = m[1].trim().replace(/\s+/g, ' ')
      if (candidate.length >= 3 && !/^(the|a|an|my|our)$/i.test(candidate)) {
        company = candidate
        break
      }
    }
  }

  const quoted = text.match(/["']([^"']{3,60})["']/)
  if (quoted) company = quoted[1].trim()

  let personRole = ''
  const roleMatch = lower.match(ROLE_RE)
  if (roleMatch) personRole = roleMatch[1].replace(/\./g, '')

  const requestedInfo = []
  if (/\blinkedin\b/i.test(lower)) requestedInfo.push('linkedin_profile')
  if (/\b(email|e-?mail)\b/i.test(lower)) requestedInfo.push('email')
  if (/\b(phone|mobile|contact number)\b/i.test(lower)) requestedInfo.push('phone')

  const productMatch = lower.match(
    /\b(toy|toys|textile|plastic|food|pharma|auto|leather|chemical|steel|garment|handicraft|jewelry|jewellery)\w*\b/i
  )

  return {
    company: company.slice(0, 80),
    personRole: personRole.slice(0, 40),
    requestedInfo,
    location: {
      cities: parsed.filters.cities || [],
      states: parsed.filters.states || [],
    },
    product: productMatch?.[0] || '',
    keywords: parsed.filters.keywords || '',
    naturalQuery: parsed.naturalQuery || text,
  }
}

export function isPersonDiscoveryRequest(message, entities) {
  const lower = String(message || '').toLowerCase()
  const hasCompany = Boolean(entities.company)
  const hasRole = Boolean(entities.personRole)
  const wantsProfile = entities.requestedInfo.includes('linkedin_profile')

  if (wantsProfile && (hasCompany || hasRole)) return true
  if (hasRole && hasCompany) return true
  if (/\blinkedin\s+(profile|url|page)\b/i.test(lower) && hasCompany) return true
  if (/\b(founder|ceo)\s+of\b/i.test(lower)) return true

  return false
}

export function isCompanyIntelligenceRequest(message, entities) {
  const lower = String(message || '').toLowerCase()
  if (isPersonDiscoveryRequest(message, entities)) return false
  return (
    /\b(tell me about|research|what is|overview of|intel on)\b/i.test(lower) &&
    Boolean(entities.company)
  )
}

export function buildUnderstandingLine({ intentCategory, entities, message, queryUnderstanding }) {
  if (queryUnderstanding?.explanation) {
    return queryUnderstanding.explanation
  }

  const parts = []
  if (entities.personRole && entities.company) {
    parts.push(`the **${entities.personRole}** at **${entities.company}**`)
  } else if (entities.company) {
    parts.push(`**${entities.company}**`)
  } else if (entities.product || entities.keywords) {
    parts.push(`**${entities.product || entities.keywords}** businesses`)
  }

  const loc = [...entities.location.cities, ...entities.location.states].filter(Boolean)
  if (loc.length) parts.push(`in **${loc.join(', ')}**`)

  if (entities.requestedInfo.includes('linkedin_profile')) {
    parts.push('with a **verified public LinkedIn profile**')
  }

  if (!parts.length) {
    if (intentCategory === 'crm_follow_up') return "leads that need **follow-up today** in your pipeline"
    if (intentCategory === 'lead_generation') return "qualified **companies** matching your market search"
    return 'your sales request'
  }

  return parts.join(' ')
}
