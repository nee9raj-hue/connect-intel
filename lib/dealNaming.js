/** Auto-generated CRM deal names: DD-MM-YYYY CompanyName 001 | Q#### */

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function formatDealNameDate(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`
}

export function sanitizeDealCompanyName(company) {
  const cleaned = String(company || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.&'-]/g, '')
    .slice(0, 60)
  return cleaned || 'Company'
}

function dealCreatedOnDate(deal, dateStr) {
  if (!deal) return false
  if (deal.createdAt) {
    const created = formatDealNameDate(new Date(deal.createdAt))
    if (created === dateStr) return true
  }
  const name = String(deal.name || '')
  return name.startsWith(`${dateStr} `)
}

function existingNamesSet(deals) {
  return new Set((deals || []).map((d) => String(d.name || '').trim().toLowerCase()).filter(Boolean))
}

function randomQuerySuffix() {
  return `Q${Math.floor(1000 + Math.random() * 9000)}`
}

/**
 * Build deal name: first same-day deal → … 001; further same-day → … Q#### (query ref).
 * @param {{ company?: string, existingDeals?: object[], date?: Date }} opts
 */
export function buildAutoDealName({ company, existingDeals = [], date = new Date() } = {}) {
  const dateStr = formatDealNameDate(date)
  const companyLabel = sanitizeDealCompanyName(company)
  const prefix = `${dateStr} ${companyLabel}`

  const sameDay = (existingDeals || []).filter((d) => dealCreatedOnDate(d, dateStr))
  const taken = existingNamesSet(existingDeals)

  let candidate
  if (sameDay.length === 0) {
    candidate = `${prefix} 001`
  } else {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      candidate = `${prefix} ${randomQuerySuffix()}`
      if (!taken.has(candidate.toLowerCase())) break
    }
    if (taken.has(candidate.toLowerCase())) {
      candidate = `${prefix} Q${Date.now().toString().slice(-4)}`
    }
  }

  if (!taken.has(candidate.toLowerCase())) return candidate

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const alt = `${prefix} ${randomQuerySuffix()}`
    if (!taken.has(alt.toLowerCase())) return alt
  }
  return `${prefix} Q${Date.now().toString().slice(-4)}`
}

/** Deep-clone freight payload for duplicate (strip ids/timestamps if any). */
export function cloneDealPayloadForDuplicate(deal) {
  if (!deal || typeof deal !== 'object') return {}
  let freight = null
  if (deal.freight) {
    try {
      freight = JSON.parse(JSON.stringify(deal.freight))
    } catch {
      freight = { ...deal.freight }
    }
  }
  return {
    amount: deal.amount ?? null,
    currency: deal.currency,
    expectedCloseDate: deal.expectedCloseDate || null,
    notes: deal.notes || '',
    freight,
  }
}
