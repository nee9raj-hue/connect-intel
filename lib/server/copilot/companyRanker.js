/**
 * Rank discovery results — quality over quantity.
 */

import { hasValidEmail } from '../leadQuality.js'

function hasEmail(company) {
  const e = String(company.email || '').trim()
  return e.length > 3 && hasValidEmail(e)
}

function hasPhone(company) {
  const p = String(company.phone || '').replace(/\D/g, '')
  return p.length >= 10
}

export function rankDiscoveryCompanies(companies, { exportCountries = [] } = {}) {
  const ranked = (companies || []).map((c) => {
    let score = 40
    const reasons = []

    if (c.website || c.companyDomain) {
      score += 12
      reasons.push('Website listed')
    }
    if (hasEmail(c)) {
      score += 22
      reasons.push('Public business email')
    }
    if (c.contactName || c.title) {
      score += 12
      reasons.push('Decision maker identified')
    }
    if (!c.inCrm && !c.leadId) {
      score += 12
      reasons.push('Not in CRM')
    }
    if (c.exportMarkets || exportCountries.length) {
      score += 8
      reasons.push('Export activity')
    }
    if (hasPhone(c)) {
      score += 5
      reasons.push('Public phone')
    }
    if (c.linkedinUrl) {
      score += 5
      reasons.push('LinkedIn page')
    }
    if (c.industry) score += 3

    let tier = 'possible'
    let stars = 2
    let tierLabel = 'Possible match'

    if (score >= 88) {
      tier = 'top'
      stars = 5
      tierLabel = 'Top recommended'
    } else if (score >= 72) {
      tier = 'good'
      stars = 4
      tierLabel = 'Good match'
    } else if (score >= 58) {
      tier = 'good'
      stars = 3
      tierLabel = 'Good match'
    }

    return {
      ...c,
      rankScore: score,
      tier,
      stars,
      tierLabel,
      rankReason: reasons.length ? reasons.join(' · ') : 'Limited public data',
      confidence: score >= 72 ? 'high' : score >= 55 ? 'medium' : 'low',
    }
  })

  ranked.sort((a, b) => b.rankScore - a.rankScore)
  return ranked
}

export function summarizeRankedCompanies(companies) {
  const top = companies.filter((c) => c.tier === 'top')
  const good = companies.filter((c) => c.tier === 'good')
  const parts = []
  if (top.length) parts.push(`**${top.length}** top recommended`)
  if (good.length) parts.push(`**${good.length}** good matches`)
  const rest = companies.length - top.length - good.length
  if (rest > 0) parts.push(`**${rest}** possible matches`)
  return parts.join(' · ') || `**${companies.length}** companies`
}

export function topProspectSummary(companies, limit = 3) {
  return companies
    .filter((c) => c.tier === 'top' || c.tier === 'good')
    .slice(0, limit)
    .map((c) => `**${c.company}** — ${c.rankReason}`)
}
