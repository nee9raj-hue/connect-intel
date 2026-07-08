/**
 * Extract capture fields from LinkedIn profiles and generic web pages.
 * Constitution: visible page metadata only — no hidden DOM scraping beyond active tab.
 */

const parseApi = () => globalThis.__connectIntelLinkedInParse || {}

function safeQuerySelector(selector, root = document) {
  try {
    return root.querySelector(selector)
  } catch {
    return null
  }
}

function firstText(selectors, root = document) {
  for (const selector of selectors) {
    try {
      const el = root.querySelector(selector)
      const text = el?.textContent?.trim()
      if (text) return text
    } catch {
      /* invalid selector on some pages */
    }
  }
  return ''
}

function allText(selectors, root = document) {
  const out = []
  for (const selector of selectors) {
    try {
      for (const el of root.querySelectorAll(selector)) {
        const text = el?.textContent?.trim()
        if (text) out.push(text)
      }
    } catch {
      /* ignore */
    }
  }
  return out
}

function isLinkedInProfileUrl(url = '') {
  return /linkedin\.com\/in\//i.test(String(url || location.href || ''))
}

function nameFromDocumentTitle() {
  const raw = String(document.title || '')
    .replace(/\s*\|\s*LinkedIn.*$/i, '')
    .replace(/\s*-\s*LinkedIn.*$/i, '')
    .trim()
  if (!raw) return ''

  const primary = raw.split(' - ')[0]?.split('|')[0]?.trim() || ''
  if (primary.length < 2 || primary.length > 80) return ''
  if (/^linkedin$/i.test(primary)) return ''
  return primary
}

function findLinkedInProfileName() {
  const fromTitle = nameFromDocumentTitle()
  if (fromTitle) return fromTitle

  const main = document.querySelector('main') || document
  const fromH1 = firstText(
    [
      'h1.text-heading-xlarge',
      'h1.inline.t-24',
      'h1[class*="text-heading"]',
      'main section:first-of-type h1',
      'main h1',
      '.pv-text-details__left-panel h1',
      'h1',
    ],
    main
  )
  if (fromH1 && fromH1.length < 80) return fromH1

  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
  if (ogTitle) {
    const cleaned = ogTitle.replace(/\s*\|\s*LinkedIn.*$/i, '').trim()
    if (cleaned.length >= 2 && cleaned.length < 80) return cleaned
  }

  return ''
}

function findLinkedInHeadline() {
  const main = document.querySelector('main') || document
  const fromDom = firstText(
    [
      '.text-body-medium.break-words',
      'div.text-body-medium',
      '.text-body-medium',
      '[data-generated-suggestion-target]',
      '.pv-text-details__left-panel .text-body-medium',
      'main section:first-of-type .text-body-medium',
      'main .text-body-medium',
    ],
    main
  )
  if (fromDom) return fromDom

  const rawTitle = String(document.title || '')
  const dashIdx = rawTitle.indexOf(' - ')
  if (dashIdx > 0) {
    const segment = rawTitle
      .slice(dashIdx + 3)
      .replace(/\s*\|\s*LinkedIn.*$/i, '')
      .trim()
    if (segment.length >= 4 && segment.length < 240) return segment
  }

  return ''
}

function looksLikeLocationText(text = '', exclude = []) {
  const { isLikelyLocationText } = parseApi()
  if (isLikelyLocationText) return isLikelyLocationText(text, exclude)
  const value = String(text || '').trim()
  return Boolean(value) && value.length <= 80 && value.includes(',')
}

function findLinkedInLocationFromTopCard(exclude = []) {
  const main = document.querySelector('main')
  if (!main) return ''

  const sections = main.querySelectorAll('section')
  const roots = sections.length ? [sections[0], main] : [main]

  for (const root of roots) {
    for (const el of root.querySelectorAll('span, div, li, p')) {
      if (el.children?.length > 2) continue
      const text = el.textContent?.trim()
      if (looksLikeLocationText(text, exclude)) return text
    }
  }

  return ''
}

function findLinkedInLocationFromProfileText(exclude = []) {
  const main = document.querySelector('main')
  if (!main) return ''

  const block = main.innerText?.slice(0, 4000) || ''
  const patterns = [
    /\b(Greater\s+[A-Za-z][\w\s.'-]{1,40}\s+Area)\b/i,
    /\b([A-Za-z][\w\s.'-]{2,40}\s+Metropolitan\s+Area)\b/i,
    /\b([A-Za-z][\w\s.'-]{2,40},\s*[A-Za-z][\w\s.'-]{2,40}(?:,\s*India)?)\b/,
  ]

  for (const re of patterns) {
    const match = block.match(re)
    const candidate = match?.[1]?.trim()
    if (candidate && looksLikeLocationText(candidate, exclude)) return candidate
  }

  return ''
}

function findLinkedInLocation(exclude = []) {
  const candidates = allText(
    [
      '.pv-text-details__left-panel span.text-body-small',
      'main section:first-of-type span.text-body-small',
      'span.text-body-small.inline.t-black--light.break-words',
      '.text-body-small.inline.t-black--light',
      'div.pv-top-card--list-bullet span',
      'li.text-body-small span',
      'main section:first-of-type span.t-black--light',
      'main section:first-of-type span[class*="text-body-small"]',
      'main section:first-of-type span[class*="t-black--light"]',
      '[data-view-name="profile-top-card"] span',
      'section.artdeco-card span.text-body-small',
    ],
    document.querySelector('main') || document
  )

  for (const text of candidates) {
    if (looksLikeLocationText(text, exclude)) return text
  }

  const fromTopCard = findLinkedInLocationFromTopCard(exclude)
  if (fromTopCard) return fromTopCard

  return findLinkedInLocationFromProfileText(exclude)
}

function companyLabelFromLink(a) {
  const { cleanCompanyLabel } = parseApi()
  const clean = cleanCompanyLabel || ((v) => String(v || '').trim())
  const label =
    a.querySelector('span[aria-hidden="true"]')?.textContent?.trim() ||
    a.getAttribute('aria-label') ||
    a.textContent?.trim()
  const company = clean(label)
  if (company && company.length >= 2 && company.length <= 120 && !/logo|company page/i.test(company)) {
    return company
  }
  return ''
}

// The top card's company link is the person's *current* employer — this avoids
// sidebar contamination ("People also viewed", "You might like", promoted pages).
function findLinkedInTopCardCompany() {
  const main = document.querySelector('main')
  if (!main) return ''
  const topCard =
    main.querySelector('[data-view-name="profile-top-card"]') ||
    main.querySelector('section') ||
    main
  for (const a of topCard.querySelectorAll('a[href*="/company/"]')) {
    const company = companyLabelFromLink(a)
    if (company) return company
  }
  return ''
}

function findLinkedInExperienceSection() {
  return (
    document.querySelector('#experience')?.closest('section') ||
    document.querySelector('section[data-section="experience"]') ||
    safeQuerySelector('section:has(#experience)')
  )
}

// Company link, but only from within the Experience section — never a page-wide
// scan, which would pick up companies the person merely follows (Interests).
function findLinkedInExperienceLinkCompany() {
  const section = findLinkedInExperienceSection()
  if (!section) return ''
  for (const a of section.querySelectorAll('a[href*="/company/"]')) {
    const company = companyLabelFromLink(a)
    if (company) return company
  }
  return ''
}

function findLinkedInCurrentCompanyButton() {
  const { cleanCompanyLabel } = parseApi()
  const clean = cleanCompanyLabel || ((v) => String(v || '').trim())

  const buttonLabel = firstText([
    'button[aria-label*="Current company"]',
    'button[aria-label*="current company"]',
  ])
  if (buttonLabel) return clean(buttonLabel)
  return ''
}

function findLinkedInTopExperience() {
  const { companyFromExperienceLines } = parseApi()
  const section = findLinkedInExperienceSection()
  if (!section) return { title: '', company: '' }

  const item = section.querySelector('li, .pvs-list__paged-list-item, .artdeco-list__item')
  if (!item) return { title: '', company: '' }

  const lines = [...item.querySelectorAll('span[aria-hidden="true"]')]
    .map((el) => el.textContent?.trim())
    .filter(Boolean)

  const companyLink = item.querySelector('a[href*="/company/"] span[aria-hidden="true"]')
  const companyFromLink = companyLink?.textContent?.trim() || ''
  const companyFromLines = companyFromExperienceLines
    ? companyFromExperienceLines(lines)
    : lines[1] || ''

  return {
    title: lines[0] || '',
    company: companyFromLink || companyFromLines,
  }
}

function findLinkedInIndustry() {
  const industry = firstText([
    '#industry ~ div span',
    'section[data-section="industry"] span',
    'button[aria-label*="Industry"]',
  ])
  return industry.replace(/^industry:\s*/i, '').trim()
}

function findLinkedInEducationNote() {
  const section =
    document.querySelector('#education')?.closest('section') ||
    document.querySelector('section[data-section="education"]')
  if (!section) return ''

  const school = section.querySelector('a[href*="/school/"] span[aria-hidden="true"]')
  const degree = section.querySelector('span.t-14.t-normal span[aria-hidden="true"]')
  const parts = [school?.textContent?.trim(), degree?.textContent?.trim()].filter(Boolean)
  return parts.length ? `Education: ${parts.join(' · ')}` : ''
}

function findMailtoTelAndVisibleContacts() {
  const { findEmailInText, findPhoneInText, normalizePhone } = parseApi()
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

  const dialog =
    document.querySelector('[role="dialog"]') ||
    document.querySelector('.pv-contact-info') ||
    document.querySelector('[data-test-modal-id="contact-info"]')

  const contactRoot = dialog || document.body
  const contactText = contactRoot?.innerText?.slice(0, 40_000) || ''

  if (!email && findEmailInText) email = findEmailInText(contactText)
  if (!phone && findPhoneInText) phone = findPhoneInText(contactText)

  const pageText = document.body?.innerText?.slice(0, 120_000) || ''
  if (!email && findEmailInText) email = findEmailInText(pageText)
  if (!phone && findPhoneInText) phone = findPhoneInText(pageText)

  return { email, phone }
}

function resolveLinkedInCompany({
  jsonLdCompany,
  headlineCompany,
  experience,
  experienceLinkCompany,
  buttonCompany,
  topCardCompany,
}) {
  const { pickCompanyName, cleanCompanyLabel } = parseApi()
  if (pickCompanyName) {
    return pickCompanyName({
      jsonLdCompany,
      topCardCompany,
      buttonCompany,
      experienceCompany: experience?.company,
      experienceLinkCompany,
      headlineCompany,
    })
  }

  const clean = cleanCompanyLabel || ((v) => String(v || '').trim())
  const candidates = [jsonLdCompany, topCardCompany, buttonCompany, experience?.company, experienceLinkCompany, headlineCompany]
    .map((c) => clean(c))
    .filter((c) => c && c.length >= 2 && c.length <= 120)
  for (const c of candidates) {
    if (!/forbes|consultant|\d+u\d+/i.test(c)) return c
  }
  return candidates[0] || ''
}

function buildLinkedInNotes({ headline, title, education, industry }) {
  const lines = []
  if (headline && headline !== title) lines.push(`Headline: ${headline}`)
  if (industry) lines.push(`Industry: ${industry}`)
  if (education) lines.push(education)
  return lines.join('\n').slice(0, 2000)
}

// LinkedIn ships an authoritative Person node in <script type="application/ld+json">.
// This is the most reliable source for employer/location and is immune to the
// DOM contamination (followed companies, recommendations) that misled scraping.
function readLinkedInJsonLd() {
  const { parseLinkedInJsonLd } = parseApi()
  if (!parseLinkedInJsonLd) return null
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    const parsed = parseLinkedInJsonLd(script.textContent || '')
    if (parsed && (parsed.company || parsed.name)) return parsed
  }
  return null
}

function extractLinkedInProfile() {
  const url = String(location.href || '').split('?')[0]
  if (!isLinkedInProfileUrl(url)) return null

  const { parseHeadline, splitPersonName, parseLocationToCityState } = parseApi()
  const parseHeadlineFn = parseHeadline || (() => ({ title: '', company: '' }))
  const splitNameFn = splitPersonName || (() => ({ firstName: '', lastName: '' }))
  const parseLocFn = parseLocationToCityState || (() => ({ city: '', state: '', location: '' }))

  const jsonLd = readLinkedInJsonLd()

  const name = jsonLd?.name || findLinkedInProfileName()
  const headline = findLinkedInHeadline()
  const parsedHeadline = parseHeadlineFn(headline)
  const experience = findLinkedInTopExperience()
  const topCardCompany = findLinkedInTopCardCompany()
  const experienceLinkCompany = findLinkedInExperienceLinkCompany()
  const buttonCompany = findLinkedInCurrentCompanyButton()
  const { firstName, lastName } = splitNameFn(name)

  const title = experience.title || parsedHeadline.title || jsonLd?.title || ''
  const company = resolveLinkedInCompany({
    jsonLdCompany: jsonLd?.company,
    headlineCompany: parsedHeadline.company,
    experience,
    experienceLinkCompany,
    buttonCompany,
    topCardCompany,
  })

  let city = jsonLd?.city || ''
  let state = jsonLd?.state || ''
  let parsedLocation = jsonLd?.location || ''
  if (!city && !state) {
    const locationRaw = findLinkedInLocation([headline, name, company])
    const parsed = parseLocFn(locationRaw)
    city = parsed.city
    state = parsed.state
    parsedLocation = parsed.location || locationRaw
  }
  const industry = findLinkedInIndustry()
  const education = findLinkedInEducationNote()
  const { email, phone } = findMailtoTelAndVisibleContacts()

  return {
    pageType: 'linkedin_profile',
    sourcePage: url,
    firstName,
    lastName,
    title,
    company,
    city,
    state,
    location: parsedLocation || [city, state].filter(Boolean).join(', '),
    industry: industry || '',
    linkedin: url,
    email,
    phone,
    notes: buildLinkedInNotes({ headline, title, education, industry }),
  }
}

function extractGenericPage() {
  const { findEmailInText, findPhoneInText } = parseApi()
  const url = String(location.href || '').split('?')[0]
  const title = String(document.title || '').trim()
  const selection = String(window.getSelection?.()?.toString?.() || '').trim()
  const pageText = document.body?.innerText?.slice(0, 120_000) || ''

  let company = ''
  if (title) {
    company = title.split('|')[0]?.split('–')[0]?.split('-')[0]?.trim() || title
  }

  let companyDomain = ''
  try {
    companyDomain = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    companyDomain = ''
  }

  return {
    pageType: 'generic_page',
    sourcePage: url,
    company: company.slice(0, 160),
    companyDomain,
    email: findEmailInText ? findEmailInText(pageText) : '',
    phone: findPhoneInText ? findPhoneInText(pageText) : '',
    notes: selection.slice(0, 500),
  }
}

function extractPageCapture() {
  const host = String(location.hostname || '').toLowerCase()
  if (host.includes('linkedin.com')) {
    return extractLinkedInProfile() || extractGenericPage()
  }
  return extractGenericPage()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** LinkedIn is a SPA — profile DOM (esp. the Experience section) may render after
 * document_idle, so give the company a chance to load before returning. */
async function extractPageCaptureWhenReady(maxWaitMs = 6000) {
  const started = Date.now()
  // Company from the Experience section is the reliable source and may lag, so
  // wait a bit longer for it before falling back to whatever we have.
  const companyGraceMs = 3000
  let last = null

  while (Date.now() - started < maxWaitMs) {
    last = extractPageCapture()
    const name = [last?.firstName, last?.lastName].filter(Boolean).join(' ')
    const hasCore = Boolean(name || last?.company)
    const hasLocation = Boolean(last?.city || last?.state || last?.location)
    const isProfile = last?.pageType === 'linkedin_profile'

    if (hasCore && (!isProfile || hasLocation)) {
      // Ready on name+location; keep waiting briefly if company hasn't loaded yet.
      if (!isProfile || last?.company || Date.now() - started >= companyGraceMs) {
        return last
      }
    }
    await sleep(400)
  }

  return last || extractPageCapture()
}

if (typeof globalThis !== 'undefined') {
  globalThis.__connectIntelExtractPage = extractPageCapture
  globalThis.__connectIntelExtractPageReady = extractPageCaptureWhenReady
}
