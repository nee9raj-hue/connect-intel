/**
 * Mandatory compact response sections per Connect Copilot spec.
 */

export function buildV3Reply({
  understanding = '',
  answer = '',
  crmFindings = [],
  externalFindings = [],
  recommendations = '',
  webFindings,
  companyIntel = [],
  recentNews = [],
}) {
  const parts = []

  if (understanding) parts.push(`**Understanding:** ${String(understanding).trim()}`)
  if (answer) parts.push(`**Answer:** ${String(answer).trim()}`)

  const crm = crmFindings.length ? crmFindings : []
  if (crm.length) {
    parts.push('\n**CRM findings**')
    for (const line of crm.slice(0, 6)) parts.push(`- ${line}`)
  }

  const external = externalFindings.length
    ? externalFindings
    : webFindings?.length
      ? webFindings
      : []
  if (external.length) {
    parts.push('\n**External findings**')
    for (const line of external.slice(0, 8)) parts.push(`- ${line}`)
  }

  if (companyIntel.length) {
    parts.push('\n**Company intelligence**')
    for (const line of companyIntel.slice(0, 5)) parts.push(`- ${line}`)
  }

  if (recentNews.length) {
    parts.push('\n**Recent news**')
    for (const line of recentNews.slice(0, 3)) parts.push(`- ${line}`)
  }

  if (recommendations) parts.push(`\n**Recommended next:** ${String(recommendations).trim()}`)

  return parts.join('\n').trim()
}

/** V4 conversational response format */
export function buildV4Reply({
  approach = '',
  whatIFound = '',
  whyItMatters = '',
  crmFindings = [],
  externalFindings = [],
  nbsa = '',
}) {
  const parts = []

  if (approach) parts.push(`**Understanding your request:** ${String(approach).trim()}`)
  if (whatIFound) parts.push(`\n**What I found:** ${String(whatIFound).trim()}`)
  if (whyItMatters) parts.push(`\n**Why it matters:** ${String(whyItMatters).trim()}`)

  if (crmFindings.length) {
    parts.push('\n**CRM**')
    for (const line of crmFindings.slice(0, 5)) parts.push(`- ${line}`)
  }

  if (externalFindings.length) {
    parts.push('\n**Public sources**')
    for (const line of externalFindings.slice(0, 6)) parts.push(`- ${line}`)
  }

  if (nbsa) parts.push(`\n**If I were handling this account:** ${String(nbsa).trim()}`)

  return parts.join('\n').trim()
}

export function buildStructuredReply({
  shortAnswer,
  crmFindings = [],
  webFindings = [],
  companyIntel = [],
  recentNews = [],
  nextStep = '',
}) {
  const parts = []

  if (shortAnswer) parts.push(`**Answer:** ${String(shortAnswer).trim()}`)

  if (crmFindings.length) {
    parts.push('\n**CRM findings**')
    for (const line of crmFindings.slice(0, 6)) {
      parts.push(`- ${line}`)
    }
  }

  if (webFindings.length) {
    parts.push('\n**Web findings**')
    for (const line of webFindings.slice(0, 8)) {
      parts.push(`- ${line}`)
    }
  }

  if (companyIntel.length) {
    parts.push('\n**Company intelligence**')
    for (const line of companyIntel.slice(0, 5)) {
      parts.push(`- ${line}`)
    }
  }

  if (recentNews.length) {
    parts.push('\n**Recent news**')
    for (const line of recentNews.slice(0, 3)) {
      parts.push(`- ${line}`)
    }
  }

  if (nextStep) parts.push(`\n**Next step:** ${nextStep}`)

  return parts.join('\n').trim()
}

export function bulletsFromText(text, max = 6) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').replace(/\[\d+\]/g, '').trim())
    .filter((l) => l.length > 8 && !/^sources?$/i.test(l))
  return lines.slice(0, max)
}

export function extractNewsLines(text) {
  return bulletsFromText(text, 8).filter((l) =>
    /news|funding|raised|launch|acqui|partnership|expan/i.test(l)
  )
}
