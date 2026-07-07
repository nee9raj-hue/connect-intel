/**
 * Extract capture fields from LinkedIn profiles and generic web pages.
 * Constitution: visible page metadata only — no hidden DOM scraping beyond active tab.
 * NOTE: Content scripts are classic scripts (no export/import).
 */

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

function parseHeadline(headline = '') {
  const value = String(headline || '').trim()
  if (!value) return { title: '', company: '' }

  const atMatch = value.match(/^(.+?)\s+at\s+(.+)$/i)
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim() }
  }

  const pipeParts = value.split('|').map((p) => p.trim()).filter(Boolean)
  if (pipeParts.length >= 2) {
    return { title: pipeParts[0], company: pipeParts[pipeParts.length - 1] }
  }

  return { title: value, company: '' }
}

function splitPersonName(fullName = '') {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return { firstName: '', lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function findEmailOnPage() {
  const text = document.body?.innerText?.slice(0, 120_000) || ''
  const match = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)
  return match ? match[0].toLowerCase() : ''
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

function findLinkedInCurrentCompany() {
  const buttonLabel = firstText([
    'button[aria-label*="Current company"]',
    'button[aria-label*="current company"]',
  ])
  if (buttonLabel) {
    const cleaned = buttonLabel
      .replace(/^current company:\s*/i, '')
      .replace(/\.\s*click.*$/i, '')
      .trim()
    if (cleaned) return cleaned
  }

  return firstText([
    '#experience ~ div li span[aria-hidden="true"]',
    'section[data-section="experience"] li span[aria-hidden="true"]',
    'section:has(#experience) li span[aria-hidden="true"]',
  ])
}

function extractLinkedInProfile() {
  const url = String(location.href || '').split('?')[0]
  if (!isLinkedInProfileUrl(url)) return null

  const name = findLinkedInProfileName()
  const headline = findLinkedInHeadline()
  const { title, company } = parseHeadline(headline)
  const { firstName, lastName } = splitPersonName(name)

  let resolvedCompany = company
  if (!resolvedCompany) {
    const experienceCompany = findLinkedInCurrentCompany()
    if (experienceCompany && experienceCompany.length < 120) {
      resolvedCompany = experienceCompany
    }
  }

  return {
    pageType: 'linkedin_profile',
    sourcePage: url,
    firstName,
    lastName,
    title,
    company: resolvedCompany,
    linkedin: url,
    email: findEmailOnPage(),
    notes: headline && headline !== title ? headline : '',
  }
}

function extractGenericPage() {
  const url = String(location.href || '').split('?')[0]
  const title = String(document.title || '').trim()
  const selection = String(window.getSelection?.()?.toString?.() || '').trim()

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
    email: findEmailOnPage(),
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
async function extractPageCaptureWhenReady(maxWaitMs = 2500) {
  const started = Date.now()
  let last = null

  while (Date.now() - started < maxWaitMs) {
    last = extractPageCapture()
    const name = [last?.firstName, last?.lastName].filter(Boolean).join(' ')
    const hasData = Boolean(
      name || last?.company || last?.title || last?.linkedin || last?.email
    )
    if (hasData) return last
    await sleep(400)
  }

  return last || extractPageCapture()
}

if (typeof globalThis !== 'undefined') {
  globalThis.__connectIntelExtractPage = extractPageCapture
  globalThis.__connectIntelExtractPageReady = extractPageCaptureWhenReady
}
