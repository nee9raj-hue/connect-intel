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

function isNoiseLocationText(text = '') {
  return /connection|follower|contact info|^\d+\+?$/i.test(String(text || '').trim())
}

function looksLikeLocationText(text = '') {
  const value = String(text || '').trim()
  if (!value || value.length > 120) return false
  if (isNoiseLocationText(value)) return false
  if (/\b(founder|ceo|director|consultant|forbes)\b/i.test(value)) return false
  if (value.includes(',')) return true
  if (/\b(area|india|metropolitan|region|district|county|gujarat|maharashtra|karnataka)\b/i.test(value)) {
    return true
  }
  if (/^greater\s+[a-z]/i.test(value)) return true
  return false
}

function findLinkedInLocationFromTopCard() {
  const main = document.querySelector('main')
  if (!main) return ''

  const sections = main.querySelectorAll('section')
  const roots = sections.length ? [sections[0], main] : [main]

  for (const root of roots) {
    for (const el of root.querySelectorAll('span, div, li, p')) {
      if (el.children?.length > 2) continue
      const text = el.textContent?.trim()
      if (looksLikeLocationText(text)) return text
    }
  }

  return ''
}

function findLinkedInLocationFromProfileText() {
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
    if (candidate && looksLikeLocationText(candidate)) return candidate
  }

  return ''
}

function findLinkedInLocation() {
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
    if (looksLikeLocationText(text)) return text
  }

  const fromTopCard = findLinkedInLocationFromTopCard()
  if (fromTopCard) return fromTopCard

  return findLinkedInLocationFromProfileText()
}

function findLinkedInCompanyFromLinks() {
  const { cleanCompanyLabel } = parseApi()
  const clean = cleanCompanyLabel || ((v) => String(v || '').trim())

  const links = document.querySelectorAll('a[href*="/company/"]')
  for (const a of links) {
    const label =
      a.querySelector('span[aria-hidden="true"]')?.textContent?.trim() ||
      a.getAttribute('aria-label') ||
      a.textContent?.trim()
    const company = clean(label)
    if (company && company.length >= 2 && company.length <= 120 && !/logo|company page/i.test(company)) {
      return company
    }
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
  const section =
    document.querySelector('#experience')?.closest('section') ||
    document.querySelector('section[data-section="experience"]') ||
    safeQuerySelector('section:has(#experience)')

  if (!section) return { title: '', company: '' }

  const item = section.querySelector('li, .pvs-list__paged-list-item, .artdeco-list__item')
  if (!item) return { title: '', company: '' }

  const lines = [...item.querySelectorAll('span[aria-hidden="true"]')]
    .map((el) => el.textContent?.trim())
    .filter(Boolean)

  const companyLink = item.querySelector('a[href*="/company/"] span[aria-hidden="true"]')
  const companyFromLink = companyLink?.textContent?.trim() || ''

  return {
    title: lines[0] || '',
    company: companyFromLink || lines[1] || '',
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

function resolveLinkedInCompany(headlineCompany, experience, linkCompany, buttonCompany) {
  const { cleanCompanyLabel } = parseApi()
  const clean = cleanCompanyLabel || ((v) => String(v || '').trim())

  const candidates = [linkCompany, experience?.company, buttonCompany, headlineCompany]
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

function extractLinkedInProfile() {
  const url = String(location.href || '').split('?')[0]
  if (!isLinkedInProfileUrl(url)) return null

  const { parseHeadline, splitPersonName, parseLocationToCityState } = parseApi()
  const parseHeadlineFn = parseHeadline || (() => ({ title: '', company: '' }))
  const splitNameFn = splitPersonName || (() => ({ firstName: '', lastName: '' }))
  const parseLocFn = parseLocationToCityState || (() => ({ city: '', state: '', location: '' }))

  const name = findLinkedInProfileName()
  const headline = findLinkedInHeadline()
  const parsedHeadline = parseHeadlineFn(headline)
  const experience = findLinkedInTopExperience()
  const linkCompany = findLinkedInCompanyFromLinks()
  const buttonCompany = findLinkedInCurrentCompanyButton()
  const { firstName, lastName } = splitNameFn(name)

  const title = experience.title || parsedHeadline.title || ''
  const company = resolveLinkedInCompany(
    parsedHeadline.company,
    experience,
    linkCompany,
    buttonCompany
  )

  const locationRaw = findLinkedInLocation()
  const { city, state, location: parsedLocation } = parseLocFn(locationRaw)
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
    location: parsedLocation || locationRaw,
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

/** LinkedIn is a SPA — profile DOM may render after document_idle. */
async function extractPageCaptureWhenReady(maxWaitMs = 6000) {
  const started = Date.now()
  let last = null

  while (Date.now() - started < maxWaitMs) {
    last = extractPageCapture()
    const name = [last?.firstName, last?.lastName].filter(Boolean).join(' ')
    const hasCore = Boolean(name || last?.company)
    const hasLocation = Boolean(last?.city || last?.state || last?.location)
    const isProfile = last?.pageType === 'linkedin_profile'

    if (hasCore && (!isProfile || hasLocation)) return last
    await sleep(400)
  }

  return last || extractPageCapture()
}

if (typeof globalThis !== 'undefined') {
  globalThis.__connectIntelExtractPage = extractPageCapture
  globalThis.__connectIntelExtractPageReady = extractPageCaptureWhenReady
}
