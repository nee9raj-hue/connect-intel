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

const LABELED_FIELD_ALIASES = {
  personName: [
    'contact name',
    'customer name',
    'client name',
    'full name',
    'contact person',
    'person name',
    'name of contact',
    'representative name',
  ],
  company: [
    'trade name',
    'company name',
    'business name',
    'firm name',
    'legal name',
    'organisation name',
    'organization name',
    'account name',
    'customer company',
    'company',
  ],
  email: ['contact email', 'email id', 'email address', 'e-mail', 'email'],
  emailAlt: ['firm email id', 'firm email', 'company email', 'business email'],
  phone: [
    'contact no',
    'contact number',
    'contact phone',
    'mobile no',
    'mobile number',
    'phone number',
    'phone no',
    'phone',
    'mobile',
  ],
  phoneAlt: ['firm mobile no', 'firm mobile', 'firm phone', 'alternate phone'],
  title: ['designation', 'job title', 'role', 'position'],
  city: ['city'],
  state: ['state'],
  noteGst: ['gst number', 'gst no', 'gstin'],
  noteIec: ['iec number', 'iec no', 'iec'],
  notePan: ['pan number', 'pan no', 'pan'],
  noteConstitution: ['constitution of business', 'business type'],
  noteCategory: ['category of exporters', 'exporter category'],
}

const LABEL_ALIAS_TO_FIELD = Object.fromEntries(
  Object.entries(LABELED_FIELD_ALIASES).flatMap(([field, labels]) =>
    labels.map((label) => [label, field])
  )
)

function normalizeLabelKey(raw = '') {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/[:：*]+$/g, '')
    .trim()
    .toLowerCase()
}

function mapLabelToField(label = '') {
  const key = normalizeLabelKey(label)
  if (!key) return ''
  if (LABEL_ALIAS_TO_FIELD[key]) return LABEL_ALIAS_TO_FIELD[key]
  if (key.endsWith(' name') && !key.includes('company') && !key.includes('trade')) {
    if (key.includes('contact') || key.includes('customer') || key.includes('client')) {
      return 'personName'
    }
  }
  return ''
}

function isProductPageTitle(title = '') {
  const raw = String(title || '').trim()
  if (!raw) return true
  if (/^\s*xindus\s+erp\s*$/i.test(raw)) return true
  if (/\berp\b/i.test(raw) && raw.split(/\s+/).length <= 4) return true
  if (/\b(crm|dashboard|admin|portal)\b/i.test(raw) && raw.split(/\s+/).length <= 4) return true
  return false
}

function isErpActionHeading(text = '') {
  const raw = String(text || '').trim()
  if (!raw) return true
  if (/^(manage|edit|view|create|update|add|new)\s+/i.test(raw)) return true
  if (/\b(inc|pvt|ltd|llp|llc)\b\.?$/i.test(raw) && raw.split(/\s+/).length >= 3) return true
  return false
}

function looksLikeFieldLabel(text = '') {
  const key = normalizeLabelKey(text)
  if (!key || key.length > 48) return false
  if (mapLabelToField(key)) return true
  return /^[a-z][a-z0-9\s/&()-]{1,40}$/i.test(key) && key.split(/\s+/).length <= 6
}

function cleanLabeledValue(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[:：\s-]+/, '')
    .replace(/[:：\s-]+$/, '')
    .trim()
}

function isUsableLabeledValue(value = '') {
  const cleaned = cleanLabeledValue(value)
  if (!cleaned || cleaned.length > 240) return false
  if (mapLabelToField(cleaned)) return false
  if (/^(company info|account details|contact info)$/i.test(cleaned)) return false
  return true
}

function storeLabeledPair(store, field, value) {
  if (!field || !isUsableLabeledValue(value)) return
  const cleaned = cleanLabeledValue(value)
  if (!store[field]) store[field] = cleaned
}

function parseInlineLabelValue(line = '', store = {}) {
  const match = String(line || '').match(/^(.{2,48}?)\s*[:：]\s*(.+)$/)
  if (!match) return false
  const field = mapLabelToField(match[1])
  if (!field) return false
  storeLabeledPair(store, field, match[2])
  return true
}

function collectLabelValuePairsFromText(text = '') {
  const store = {}
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (parseInlineLabelValue(line, store)) continue
  }

  for (let i = 0; i < lines.length - 1; i += 1) {
    const field = mapLabelToField(lines[i])
    if (!field) continue
    const value = lines[i + 1]
    if (!isUsableLabeledValue(value)) continue
    storeLabeledPair(store, field, value)
    i += 1
  }

  return store
}

function readInputValue(el) {
  if (!el) return ''
  const tag = String(el.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return cleanLabeledValue(el.value || el.getAttribute?.('value') || '')
  }
  return cleanLabeledValue(el.textContent || '')
}

function collectLabelValuePairsFromDom() {
  const store = {}

  for (const tr of document.querySelectorAll('tr')) {
    const cells = [...tr.querySelectorAll('th, td')]
      .map((cell) => cleanLabeledValue(cell.textContent || ''))
      .filter(Boolean)
    if (cells.length < 2) continue
    const field = mapLabelToField(cells[0])
    if (field) storeLabeledPair(store, field, cells.slice(1).join(' '))
  }

  for (const row of document.querySelectorAll('dl')) {
    const labels = row.querySelectorAll('dt')
    const values = row.querySelectorAll('dd')
    for (let i = 0; i < Math.min(labels.length, values.length); i += 1) {
      const field = mapLabelToField(labels[i].textContent || '')
      if (field) storeLabeledPair(store, field, values[i].textContent || '')
    }
  }

  const labelSelectors = [
    'label',
    'mat-label',
    '.mat-form-field-label',
    '[class*="form-label"]',
    '[class*="field-label"]',
    '[class*="label-text"]',
  ]
  for (const selector of labelSelectors) {
    try {
      for (const labelEl of document.querySelectorAll(selector)) {
        const field = mapLabelToField(labelEl.textContent || '')
        if (!field) continue
        const block =
          labelEl.closest(
            '.mat-form-field, .form-group, .field, .row, tr, dl, [class*="form-field"], [class*="field-row"]'
          ) || labelEl.parentElement
        if (!block) continue
        const valueEl = block.querySelector(
          'input, textarea, select, .mat-input-element, [class*="value"], [class*="field-value"], span:not(label):not(mat-label)'
        )
        const value = readInputValue(valueEl)
        if (value) storeLabeledPair(store, field, value)
      }
    } catch {
      /* invalid selector */
    }
  }

  return store
}

function collectLabelValuePairs() {
  const fromDom = collectLabelValuePairsFromDom()
  const pageText = document.body?.innerText?.slice(0, 120_000) || ''
  const fromText = collectLabelValuePairsFromText(pageText)
  const merged = { ...fromText, ...fromDom }
  return merged
}

function labeledPairsToContactFields(pairs = {}) {
  const { splitPersonName, normalizePhone } = linkedInParse()
  const splitName = splitPersonName || (() => ({ firstName: '', lastName: '' }))
  const normalizePhoneFn = normalizePhone || ((value) => String(value || '').trim())

  const personRaw = pairs.personName || ''
  const { firstName, lastName } = splitName(personRaw)
  const company = pairs.company || ''
  const email = String(pairs.email || pairs.emailAlt || '')
    .trim()
    .toLowerCase()
  const phone = normalizePhoneFn(pairs.phone || pairs.phoneAlt || '')

  const noteLines = []
  if (pairs.noteGst) noteLines.push(`GST: ${pairs.noteGst}`)
  if (pairs.noteIec) noteLines.push(`IEC: ${pairs.noteIec}`)
  if (pairs.notePan) noteLines.push(`PAN: ${pairs.notePan}`)
  if (pairs.noteConstitution) noteLines.push(`Business: ${pairs.noteConstitution}`)
  if (pairs.noteCategory) noteLines.push(`Exporter category: ${pairs.noteCategory}`)
  if (pairs.emailAlt && pairs.emailAlt !== pairs.email) {
    noteLines.push(`Alt email: ${pairs.emailAlt}`)
  }
  if (pairs.phoneAlt && pairs.phoneAlt !== pairs.phone) {
    noteLines.push(`Alt phone: ${pairs.phoneAlt}`)
  }

  const hasCore = Boolean((firstName && lastName) || company || email)
  if (!hasCore) return null

  return {
    firstName,
    lastName,
    company,
    email,
    phone,
    title: pairs.title || '',
    city: pairs.city || '',
    state: pairs.state || '',
    notes: noteLines.join('\n').slice(0, 2000),
    pageType: 'crm_form',
  }
}

function extractLabeledFormContact() {
  const pairs = collectLabelValuePairs()
  return labeledPairsToContactFields(pairs)
}

function personNameFromTitle(title = '') {
  const { splitPersonName, parseHeadline } = linkedInParse()
  const splitName = splitPersonName || (() => ({ firstName: '', lastName: '' }))
  const parseHeadlineFn = parseHeadline || (() => ({ title: '', company: '' }))

  const raw = String(title || '').trim()
  if (!raw || isProductPageTitle(raw)) return { firstName: '', lastName: '', title: '', company: '' }

  const parsed = parseHeadlineFn(raw)
  const primary = raw.split('|')[0]?.split('–')[0]?.trim() || raw
  const dashParts = primary.split(/\s+-\s+/)
  const nameCandidate =
    dashParts.length >= 2 && dashParts[0].length <= 40 ? dashParts[0].trim() : primary
  if (isErpActionHeading(nameCandidate)) {
    return { firstName: '', lastName: '', title: '', company: parsed.company || '' }
  }
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
      if (isErpActionHeading(text)) continue
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
  const pairs = collectLabelValuePairsFromText(sample)
  if (pairs.personName || pairs.company || pairs.email || pairs.phone) return true
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
  const labeled = extractLabeledFormContact()
  const useLabeledPrimary = Boolean(
    labeled &&
      ((labeled.firstName && labeled.lastName) || (labeled.company && (labeled.email || labeled.phone)))
  )
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
    labeled,
    schema.person,
    schema.organization,
    ...(useLabeledPrimary ? [] : [headingName, titleName, metaName]),
    {
      title: useLabeledPrimary
        ? labeled?.title || schema.person?.title || ''
        : roleNearName.title || titleParsed.title || schema.person?.title || '',
      company: useLabeledPrimary
        ? labeled?.company || schema.person?.company || schema.organization?.company || ''
        : roleNearName.company ||
          titleParsed.company ||
          titleName.company ||
          schema.person?.company ||
          schema.organization?.company ||
          og.siteName ||
          '',
      email: labeled?.email || schema.person?.email || schema.organization?.email || email,
      phone: labeled?.phone || schema.person?.phone || schema.organization?.phone || phone,
      city: labeled?.city || schema.person?.city || schema.organization?.city || '',
      state: labeled?.state || schema.person?.state || schema.organization?.state || '',
      location: labeled?.location || schema.person?.location || schema.organization?.location || '',
      linkedin,
      industry: schema.person?.industry || schema.organization?.industry || '',
      companyDomain: schema.organization?.companyDomain || companyDomain,
    }
  )

  if (!merged.location && (merged.city || merged.state)) {
    merged.location = [merged.city, merged.state].filter(Boolean).join(', ')
  }

  const notesParts = []
  if (labeled?.notes) notesParts.push(labeled.notes)
  if (og.ogDesc && og.ogDesc !== merged.title) notesParts.push(og.ogDesc.slice(0, 300))
  if (selection) notesParts.push(`Selected: ${selection.slice(0, 400)}`)

  const pageType = labeled
    ? 'crm_form'
    : schema.person || merged.firstName
      ? 'contact_page'
      : 'generic_page'

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
    extractLabeledFormContact,
    collectLabelValuePairs,
    quickContactSignals,
    hasMinimumCaptureFields,
    scoreContactCapture,
    contactFingerprint,
    dedupeCandidates,
  }
}
