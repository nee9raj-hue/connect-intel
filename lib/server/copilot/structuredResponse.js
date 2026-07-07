/**
 * Mandatory compact response sections per Connect Copilot spec.
 */

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
