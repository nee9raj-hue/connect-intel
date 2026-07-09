/**
 * Smart contact extraction for company sites, team pages, directories, and about pages.
 * Constitution: visible page metadata only — JSON-LD, open graph, mailto/tel, headings.
 */

function linkedInParse() {
  return globalThis.__connectIntelLinkedInParse || {}
}

function flattenJsonLd(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.flatMap(flattenJsonLd)
  if (Array.isArray(raw['@graph'])) return raw['@graph'].flatMap(flattenJsonLd)
  return [raw]
}

function readJsonLdNodes() {
  const nodes = []
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      nodes.push(...flattenJsonLd(JSON.parse(script.textContent || '')))
    } catch {
      /* invalid JSON-LD */
    }
  }
  return nodes
}

function nodeTypes(node) {
  const t = node?.['@type']
  if (!t) return []
  return (Array.isArray(t) ? t : [t]).map((v) => String(v).toLowerCase())
}

function nodeMatchesType(node, ...needles) {
  const types = nodeTypes(node)
  return needles.some((needle) => types.some((t) => t.includes(needle.toLowerCase())))
}

function textValue(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = textValue(item)
      if (text) return text
    }
    return ''
  }
  if (typeof value === 'object') {
    return textValue(value.name || value['@id'] || value.url || '')
  }
  return ''
}

function contactPointFields(node) {
  const email =
    textValue(node.email) ||
    (Array.isArray(node.contactPoint)
      ? node.contactPoint.map((cp) => textValue(cp.email)).find(Boolean)
      : textValue(node.contactPoint?.email))
  const phone =
    textValue(node.telephone) ||
    (Array.isArray(node.contactPoint)
      ? node.contactPoint.map((cp) => textValue(cp.telephone)).find(Boolean)
      : textValue(node.contactPoint?.telephone))
  return { email, phone }
}

function addressFields(node) {
  const addr = node.address
  if (!addr) return { city: '', state: '', location: '' }
  const { parseLocationToCityState } = linkedInParse()
  const parseLoc = parseLocationToCityState || (() => ({ city: '', state: '', location: '' }))
  const location = textValue(addr)
  const parsed = parseLoc(location)
  return {
    city: textValue(addr.addressLocality) || parsed.city,
    state: textValue(addr.addressRegion) || parsed.state,
    location: parsed.location || location,
  }
}

function parsePersonNode(node) {
  if (!nodeMatchesType(node, 'person')) return null
  const { splitPersonName } = linkedInParse()
  const splitName = splitPersonName || (() => ({ firstName: '', lastName: '' }))
  const name = textValue(node.name)
  const { firstName, lastName } = splitName(name)
  const worksFor = node.worksFor || node.affiliation
  const company = textValue(worksFor)
  const title = textValue(node.jobTitle)
  const linkedin = String(textValue(node.sameAs) || '')
    .split(/\s+/)
    .find((u) => /linkedin\.com\/in\//i.test(u)) || ''
  const { email, phone } = contactPointFields(node)
  const loc = addressFields(node)
  return {
    firstName,
    lastName,
    title,
    company,
    email,
    phone,
    linkedin,
    city: loc.city,
    state: loc.state,
    location: loc.location,
    industry: textValue(node.knowsAbout) || '',
  }
}

function parseOrganizationNode(node) {
  if (!nodeMatchesType(node, 'organization')) return null
  const { email, phone } = contactPointFields(node)
  const loc = addressFields(node)
  return {
    company: textValue(node.name),
    companyDomain: textValue(node.url).replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0],
    email,
    phone,
    city: loc.city,
    state: loc.state,
    location: loc.location,
    industry: textValue(node.industry) || '',
  }
}

function extractSchemaOrgContact() {
  let person = null
  let organization = null

  for (const node of readJsonLdNodes()) {
    if (!person) person = parsePersonNode(node)
    if (!organization) organization = parseOrganizationNode(node)
    if (person && organization) break
  }

  return { person, organization }
}

function parseOpenGraphContact() {
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || ''
  const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || ''
  const siteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || ''
  const metaAuthor = document.querySelector('meta[name="author"]')?.getAttribute('content') || ''
  return { ogTitle, ogDesc, siteName, metaAuthor }
}

function personNameFromTitle(title = '') {
  const { splitPersonName, parseHeadline } = linkedInParse()
  const splitName = splitPersonName || (() => ({ firstName: '', lastName: '' }))
  const parseHeadlineFn = parseHeadline || (() => ({ title: '', company: '' }))

  const raw = String(title || '').trim()
  if (!raw) return { firstName: '', lastName: '', title: '', company: '' }

  const parsed = parseHeadlineFn(raw)
  const primary = raw.split('|')[0]?.split('–')[0]?.trim() || raw
  const dashParts = primary.split(/\s+-\s+/)
  const nameCandidate =
    dashParts.length >= 2 && dashParts[0].length <= 40 ? dashParts[0].trim() : primary
  const nameParts = splitName(nameCandidate)

  return {
    ...nameParts,
    title: parsed.title || '',
    company: parsed.company || '',
  }
}

function findPrimaryHeadingName() {
  const { splitPersonName } = linkedInParse()
  const splitName = splitPersonName || (() => ({ firstName: '', lastName: '' }))
  const selectors = [
    'h1',
    '[class*="profile"] h1',
    '[class*="team-member"] h2',
    '[class*="contact"] h1',
    '[itemtype*="Person"] [itemprop="name"]',
    '.vcard .fn',
    '.h-card .p-name',
  ]
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector)
      const text = el?.textContent?.trim() || ''
      if (!text || text.length > 80) continue
      if (/\b(team|contact|about|leadership|our people)\b/i.test(text) && text.split(/\s+/).length <= 3) {
        continue
      }
      const parts = splitName(text)
      if (parts.firstName && parts.lastName) return parts
      if (parts.firstName && text.split(/\s+/).length <= 4) return parts
    } catch {
      /* invalid selector */
    }
  }
  return { firstName: '', lastName: '' }
}

function findLinkedInUrlInPage() {
  for (const a of document.querySelectorAll('a[href*="linkedin.com/in/"]')) {
    const href = String(a.getAttribute('href') || '').split('?')[0]
    if (/linkedin\.com\/in\//i.test(href)) return href
  }
  return ''
}

function findRoleNearName() {
  const { parseHeadline } = linkedInParse()
  const parseHeadlineFn = parseHeadline || (() => ({ title: '', company: '' }))
  const candidates = [
    'h1 + p',
    'h1 + div',
    'h1 + span',
    '[class*="profile"] h1 + *',
    '[class*="title"]',
    '[class*="role"]',
    '[class*="position"]',
    '[itemprop="jobTitle"]',
  ]
  for (const selector of candidates) {
    try {
      const el = document.querySelector(selector)
      const text = el?.textContent?.trim() || ''
      if (!text || text.length > 120) continue
      const parsed = parseHeadlineFn(text)
      if (parsed.title || parsed.company) return parsed
      if (text.length <= 80) return { title: text, company: '' }
    } catch {
      /* ignore */
    }
  }
  return { title: '', company: '' }
}

function mergeContactFields(...sources) {
  const out = {}
  const keys = [
    'firstName',
    'lastName',
    'title',
    'company',
    'email',
    'phone',
    'city',
    'state',
    'location',
    'linkedin',
    'industry',
    'companyDomain',
  ]
  for (const key of keys) {
    for (const source of sources) {
      const value = source?.[key]
      if (value != null && String(value).trim()) {
        out[key] = String(value).trim()
        break
      }
    }
  }
  return out
}

/** Fast pre-check — should we show the capture FAB on this page? */
function quickContactSignals() {
  if (document.querySelector('script[type="application/ld+json"]')) {
    try {
      const nodes = readJsonLdNodes()
      if (nodes.some((n) => nodeMatchesType(n, 'person') || nodeMatchesType(n, 'organization'))) {
        return true
      }
    } catch {
      /* ignore */
    }
  }
  if (document.querySelector('a[href^="mailto:"], a[href^="tel:"]')) return true
  if (document.querySelector('a[href*="linkedin.com/in/"]')) return true
  if (document.querySelector('[itemtype*="Person"], .vcard, .h-card, [itemprop="email"]')) return true

  const { findEmailInText, findPhoneInText } = linkedInParse()
  const sample = document.body?.innerText?.slice(0, 8000) || ''
  if (findEmailInText?.(sample) || findPhoneInText?.(sample)) return true
  return false
}

function hasMinimumCaptureFields(fields = {}) {
  const name = [fields.firstName, fields.lastName].filter(Boolean).join(' ')
  const hasIdentity = Boolean(name || fields.company)
  const hasReach =
    Boolean(fields.email || fields.phone || fields.linkedin) || Boolean(fields.company)
  return hasIdentity && hasReach
}

function scoreContactCapture(fields = {}) {
  let score = 0
  if (fields.firstName) score += 2
  if (fields.lastName) score += 1
  if (fields.email) score += 3
  if (fields.phone) score += 2
  if (fields.company) score += 2
  if (fields.title) score += 1
  if (fields.linkedin) score += 2
  if (fields.city || fields.state) score += 1
  return score
}

function contactFingerprint(fields = {}) {
  const email = String(fields.email || '')
    .trim()
    .toLowerCase()
  if (email.includes('@')) return `email:${email}`
  const linkedin = String(fields.linkedin || '')
    .split('?')[0]
    .toLowerCase()
  if (/linkedin\.com\/in\//i.test(linkedin)) return `li:${linkedin}`
  const name = [fields.firstName, fields.lastName].filter(Boolean).join(' ').trim().toLowerCase()
  const company = String(fields.company || '')
    .trim()
    .toLowerCase()
  if (name) return `name:${name}|${company}`
  return ''
}

function isQualityCandidate(fields = {}) {
  if (hasMinimumCaptureFields(fields)) return true
  return scoreContactCapture(fields) >= 4
}

function dedupeCandidates(list = []) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    const fp = contactFingerprint(item)
    if (!fp || seen.has(fp)) continue
    if (!isQualityCandidate(item)) continue
    seen.add(fp)
    out.push(item)
  }
  return out.sort((a, b) => scoreContactCapture(b) - scoreContactCapture(a))
}

function enrichCandidate(fields, url) {
  const out = { pageType: 'contact_page', sourcePage: url, ...fields }
  if (!out.location && (out.city || out.state)) {
    out.location = [out.city, out.state].filter(Boolean).join(', ')
  }
  return out
}

const TEAM_CARD_SELECTORS = [
  '[class*="team-member"]',
  '[class*="team_member"]',
  '[class*="staff-member"]',
  '[class*="person-card"]',
  '[class*="profile-card"]',
  '.vcard',
  '.h-card',
  '[itemtype*="Person"]',
]

function nearestBlock(el) {
  if (typeof el?.closest === 'function') {
    return el.closest('article, li, tr, div, section') || el.parentElement
  }
  return el?.parentElement || null
}

function findTeamMemberCards() {
  const cards = new Set()
  for (const selector of TEAM_CARD_SELECTORS) {
    try {
      document.querySelectorAll(selector).forEach((el) => cards.add(el))
    } catch {
      /* invalid selector */
    }
  }
  return [...cards]
}

function mailtoTelInRoot(root) {
  const { normalizePhone } = linkedInParse()
  let email = ''
  let phone = ''
  if (!root?.querySelectorAll) return { email, phone }
  for (const a of root.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]')) {
    const href = a.getAttribute('href') || ''
    if (!email && href.startsWith('mailto:')) {
      email = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase()
    }
    if (!phone && href.startsWith('tel:')) {
      phone = normalizePhone ? normalizePhone(href.replace(/^tel:/i, '')) : href.replace(/^tel:/i, '')
    }
  }
  return { email, phone }
}

function linkedinInRoot(root) {
  if (!root?.querySelectorAll) return ''
  for (const a of root.querySelectorAll('a[href*="linkedin.com/in/"]')) {
    const href = String(a.getAttribute('href') || '').split('?')[0]
    if (/linkedin\.com\/in\//i.test(href)) return href
  }
  return ''
}

function parsePersonFromElement(el) {
  const { splitPersonName, parseHeadline } = linkedInParse()
  const splitName = splitPersonName || (() => ({ firstName: '', lastName: '' }))
  const parseHeadlineFn = parseHeadline || (() => ({ title: '', company: '' }))

  const nameEl = el.querySelector(
    '[itemprop="name"], .fn, .p-name, h1, h2, h3, h4, [class*="name"]'
  )
  const name = nameEl?.textContent?.trim() || ''
  if (!name || name.length > 80) return null
  if (/\b(team|contact|about|leadership|our people)\b/i.test(name) && name.split(/\s+/).length <= 3) {
    return null
  }

  const { firstName, lastName } = splitName(name)
  if (!firstName) return null

  const titleEl = el.querySelector(
    '[itemprop="jobTitle"], .title, .role, [class*="title"], [class*="role"], [class*="position"]'
  )
  let title = titleEl?.textContent?.trim() || ''
  if (title.length > 120) title = ''
  const parsedRole = parseHeadlineFn(title)
  const { email, phone } = mailtoTelInRoot(el)
  const linkedin = linkedinInRoot(el)

  return {
    firstName,
    lastName,
    title: parsedRole.title || title,
    company: parsedRole.company || '',
    email,
    phone,
    linkedin,
  }
}

function parseLinkedInAnchorContext(anchor) {
  const { splitPersonName, parseHeadline } = linkedInParse()
  const splitName = splitPersonName || (() => ({ firstName: '', lastName: '' }))
  const parseHeadlineFn = parseHeadline || (() => ({ title: '', company: '' }))
  const href = String(anchor.getAttribute('href') || '').split('?')[0]
  if (!/linkedin\.com\/in\//i.test(href)) return null

  const container =
    (typeof anchor.closest === 'function'
      ? anchor.closest('article, li, tr, [class*="member"], [class*="card"], [class*="person"], [class*="team"]')
      : null) || anchor.parentElement
  if (!container) return null

  const name =
    anchor.textContent?.trim() ||
    container.querySelector('h1,h2,h3,h4,[class*="name"]')?.textContent?.trim() ||
    ''
  const { firstName, lastName } = splitName(name)
  if (!firstName) return null

  const roleText =
    container.querySelector('[class*="title"],[class*="role"],[class*="position"],p')?.textContent?.trim() ||
    ''
  const { title, company } = parseHeadlineFn(roleText)
  const { email, phone } = mailtoTelInRoot(container)

  return { firstName, lastName, title, company, email, phone, linkedin: href }
}

/**
 * Scan team/about/directory pages for multiple contact candidates.
 * Returns deduped list sorted by capture quality (best first).
 */
function extractContactCandidates() {
  const url = String(location.href || '').split('?')[0]
  let companyDomain = ''
  try {
    companyDomain = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    companyDomain = ''
  }

  const schema = extractSchemaOrgContact()
  const og = parseOpenGraphContact()
  const orgCompany = schema.organization?.company || og.siteName || ''
  const raw = []

  for (const node of readJsonLdNodes()) {
    const person = parsePersonNode(node)
    if (!person) continue
    if (!person.company && orgCompany) person.company = orgCompany
    if (!person.companyDomain && companyDomain) person.companyDomain = companyDomain
    raw.push(enrichCandidate(person, url))
  }

  for (const card of findTeamMemberCards()) {
    const person = parsePersonFromElement(card)
    if (!person) continue
    if (!person.company && orgCompany) person.company = orgCompany
    if (!person.companyDomain) person.companyDomain = companyDomain
    raw.push(enrichCandidate(person, url))
  }

  for (const anchor of document.querySelectorAll('a[href*="linkedin.com/in/"]')) {
    const parsed = parseLinkedInAnchorContext(anchor)
    if (!parsed) continue
    if (!parsed.company && orgCompany) parsed.company = orgCompany
    if (!parsed.companyDomain) parsed.companyDomain = companyDomain
    raw.push(enrichCandidate(parsed, url))
  }

  for (const anchor of document.querySelectorAll('a[href^="mailto:"]')) {
    const email = anchor
      .getAttribute('href')
      ?.replace(/^mailto:/i, '')
      .split('?')[0]
      .trim()
      .toLowerCase()
    if (!email) continue
    const block = nearestBlock(anchor)
    if (!block) continue
    const nameEl = block.querySelector('h1,h2,h3,h4,strong,[class*="name"]')
    const name = nameEl?.textContent?.trim() || ''
    const { splitPersonName } = linkedInParse()
    const splitName = splitPersonName || (() => ({ firstName: '', lastName: '' }))
    const { firstName, lastName } = splitName(name)
    if (!firstName && !lastName) continue
    const { phone } = mailtoTelInRoot(block)
    raw.push(
      enrichCandidate(
        {
          firstName,
          lastName,
          email,
          phone,
          company: orgCompany,
          companyDomain,
          linkedin: linkedinInRoot(block),
        },
        url
      )
    )
  }

  const deduped = dedupeCandidates(raw)

  if (deduped.length <= 1) {
    const single = extractContactPage()
    if (single?.email || single?.firstName || single?.company) {
      const fp = contactFingerprint(single)
      if (!fp || !deduped.some((item) => contactFingerprint(item) === fp)) {
        deduped.push(enrichCandidate(single, url))
      }
    }
  }

  return deduped.slice(0, 30)
}

/**
 * Rich contact extraction for non-LinkedIn pages (team, about, directory, company contact).
 */
function extractContactPage() {
  const { findEmailInText, findPhoneInText, normalizePhone, parseLocationToCityState, parseHeadline } =
    linkedInParse()
  const parseLoc = parseLocationToCityState || (() => ({ city: '', state: '', location: '' }))
  const parseHeadlineFn = parseHeadline || (() => ({ title: '', company: '' }))

  const url = String(location.href || '').split('?')[0]
  const pageText = document.body?.innerText?.slice(0, 120_000) || ''
  const selection = String(window.getSelection?.()?.toString?.() || '').trim()

  let companyDomain = ''
  try {
    companyDomain = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    companyDomain = ''
  }

  const schema = extractSchemaOrgContact()
  const og = parseOpenGraphContact()
  const titleName = personNameFromTitle(og.ogTitle || document.title || '')
  const headingName = findPrimaryHeadingName()
  const roleNearName = findRoleNearName()
  const linkedin = findLinkedInUrlInPage() || schema.person?.linkedin || ''

  let email = ''
  let phone = ''
  for (const a of document.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]')) {
    const href = a.getAttribute('href') || ''
    if (!email && href.startsWith('mailto:')) {
      email = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase()
    }
    if (!phone && href.startsWith('tel:')) {
      phone = normalizePhone ? normalizePhone(href.replace(/^tel:/i, '')) : href.replace(/^tel:/i, '')
    }
  }
  if (!email && findEmailInText) email = findEmailInText(pageText)
  if (!phone && findPhoneInText) phone = findPhoneInText(pageText)

  const titleParsed = parseHeadlineFn(og.ogDesc || '')
  const metaName = og.metaAuthor ? personNameFromTitle(og.metaAuthor) : { firstName: '', lastName: '' }

  const merged = mergeContactFields(
    schema.person,
    schema.organization,
    headingName,
    titleName,
    metaName,
    {
      title: roleNearName.title || titleParsed.title || schema.person?.title || '',
      company:
        roleNearName.company ||
        titleParsed.company ||
        titleName.company ||
        schema.person?.company ||
        schema.organization?.company ||
        og.siteName ||
        '',
      email: schema.person?.email || schema.organization?.email || email,
      phone: schema.person?.phone || schema.organization?.phone || phone,
      city: schema.person?.city || schema.organization?.city || '',
      state: schema.person?.state || schema.organization?.state || '',
      location: schema.person?.location || schema.organization?.location || '',
      linkedin,
      industry: schema.person?.industry || schema.organization?.industry || '',
      companyDomain: schema.organization?.companyDomain || companyDomain,
    }
  )

  if (!merged.location && (merged.city || merged.state)) {
    merged.location = [merged.city, merged.state].filter(Boolean).join(', ')
  }

  const notesParts = []
  if (og.ogDesc && og.ogDesc !== merged.title) notesParts.push(og.ogDesc.slice(0, 300))
  if (selection) notesParts.push(`Selected: ${selection.slice(0, 400)}`)

  const pageType = schema.person || merged.firstName ? 'contact_page' : 'generic_page'

  return {
    pageType,
    sourcePage: url,
    ...merged,
    notes: notesParts.join('\n').slice(0, 2000),
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.__connectIntelContactPageParse = {
    extractSchemaOrgContact,
    extractContactPage,
    extractContactCandidates,
    quickContactSignals,
    hasMinimumCaptureFields,
    scoreContactCapture,
    contactFingerprint,
    dedupeCandidates,
  }
}
