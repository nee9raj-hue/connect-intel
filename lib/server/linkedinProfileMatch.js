/**
 * Score and pick LinkedIn /in/ profile URLs against a known contact — reduces bad links.
 */

const GENERIC_SLUGS = new Set([
  'profile',
  'linkedin',
  'user',
  'member',
  'public-profile',
  'in',
  'www',
])

export function linkedinProfileSlug(url = '') {
  const raw = String(url || '').trim().toLowerCase()
  const match = raw.match(/linkedin\.com\/in\/([^/?#\s]+)/i)
  return match?.[1]?.replace(/\/$/, '') || ''
}

export function normalizePersonTokens(contact = {}) {
  const first = String(contact.firstName || '').trim().toLowerCase()
  const last = String(contact.lastName || '').trim().toLowerCase()
  const full = [first, last].filter(Boolean).join(' ')
  const company = String(contact.company || '')
    .trim()
    .toLowerCase()
    .replace(/\b(pvt|ltd|limited|llp|inc|corp|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '')

  return { first, last, full, company }
}

/**
 * Score how well a LinkedIn /in/ URL matches a person (0–30+).
 * Used to drop hallucinated or wrong-person links.
 */
export function scoreLinkedinProfileMatch(url, contact = {}, row = {}) {
  const slug = linkedinProfileSlug(url)
  if (!slug || GENERIC_SLUGS.has(slug)) return 0

  const { first, last, full, company } = normalizePersonTokens(contact)
  const slugNorm = slug.replace(/-/g, '')
  const blob = `${row.fullName || ''} ${row.title || ''} ${row.company || ''} ${row.reason || ''}`.toLowerCase()

  let score = 0

  if (full) {
    const fullSlug = full.replace(/\s+/g, '-')
    const fullCompact = full.replace(/\s+/g, '')
    if (slug === fullSlug || slugNorm === fullCompact) score += 20
    else if (slug.includes(fullSlug) || slugNorm.includes(fullCompact)) score += 16
  }

  if (first && slug.includes(first.replace(/\s+/g, '-'))) score += 8
  else if (first && slugNorm.includes(first.replace(/\s+/g, ''))) score += 7

  if (last) {
    if (slug.includes(last.replace(/\s+/g, '-'))) score += 10
    else if (slugNorm.includes(last.replace(/\s+/g, ''))) score += 9
  }

  if (company.length >= 3) {
    const companyToken = company.slice(0, Math.min(company.length, 12))
    if (slugNorm.includes(companyToken)) score += 4
    if (blob.includes(companyToken)) score += 3
  }

  if (row.reason?.includes('web search') || row.reason?.includes('citation')) score += 2
  if (row.confidence === 'high' && score >= 8) score += 2
  if (row.reason === 'Extracted from AI response') score -= 6

  if (slug.length < 4) score -= 8
  if (/^\d+$/.test(slug)) score -= 10

  return score
}

export const MIN_LINKEDIN_MATCH_SCORE = 12

export function rankLinkedinProfileMatches(matches = [], contact = {}) {
  return [...matches]
    .map((row) => ({
      ...row,
      _matchScore: scoreLinkedinProfileMatch(row.linkedin, contact, row),
    }))
    .sort((a, b) => b._matchScore - a._matchScore)
}

export function pickBestLinkedinMatch(matches = [], contact = {}, { minScore = MIN_LINKEDIN_MATCH_SCORE } = {}) {
  const ranked = rankLinkedinProfileMatches(matches, contact)
  const best = ranked[0]
  if (!best || best._matchScore < minScore) return null
  return best
}
