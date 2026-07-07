/**
 * Extract capture fields from LinkedIn profiles and generic web pages.
 * Constitution: visible page metadata only — no hidden DOM scraping beyond active tab.
 */

function firstText(selectors, root = document) {
  for (const selector of selectors) {
    const el = root.querySelector(selector)
    const text = el?.textContent?.trim()
    if (text) return text
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

export function extractLinkedInProfile() {
  const url = String(location.href || '').split('?')[0]
  if (!/\/in\//i.test(url)) return null

  const name = firstText([
    'h1.text-heading-xlarge',
    'h1.inline.t-24',
    'main h1',
    'h1',
  ])
  const headline = firstText([
    '.text-body-medium.break-words',
    '.text-body-medium',
    '[data-generated-suggestion-target]',
    '.pv-text-details__left-panel .text-body-medium',
  ])

  const { title, company } = parseHeadline(headline)
  const { firstName, lastName } = splitPersonName(name)

  let resolvedCompany = company
  if (!resolvedCompany) {
    const experienceCompany = firstText([
      '#experience ~ div li span[aria-hidden="true"]',
      'section[data-section="experience"] li span[aria-hidden="true"]',
    ])
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

export function extractGenericPage() {
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

export function extractPageCapture() {
  const host = String(location.hostname || '').toLowerCase()
  if (host.includes('linkedin.com')) {
    return extractLinkedInProfile() || extractGenericPage()
  }
  return extractGenericPage()
}

if (typeof globalThis !== 'undefined') {
  globalThis.__connectIntelExtractPage = extractPageCapture
}
