#!/usr/bin/env node
/**
 * Fill Chrome Web Store Privacy tab for Connect Intel (user clicks Submit after).
 */
import { chromium } from 'playwright'

const publisherId = '09468178-973b-4767-8214-20bc719d9f7c'
const itemId = 'bahhnjcdlpjoglipkjiamnobhikmdpkb'
const privacyUrl = `https://chrome.google.com/webstore/devconsole/${publisherId}/${itemId}/edit/privacy`
const profileDir = '/tmp/connect-intel-cws-profile'

const SINGLE_PURPOSE = `This extension is a companion for Connect Intel CRM customers. It helps sales teams match Gmail threads to CRM leads, sync email activity, capture LinkedIn profiles into the pipeline, and compose CRM emails — only for users signed in to connectintel.net.`

const JUSTIFICATIONS = {
  activeTab: `When the user opens the toolbar popup, read the current tab URL/title to offer "Add to pipeline" on contact-rich pages they are viewing.`,
  cookies: `Read the connect_intel_session cookie from connectintel.net so the signed-in user can call Connect Intel APIs with the same session as the web app (no separate extension login).`,
  storage: `Store minimal extension UI preferences only. CRM lead data is not persisted in local storage; it stays on Connect Intel servers.`,
  scripting: `Inject content scripts on Gmail, LinkedIn, and pages the user visits so the floating CRM widget and Gmail participant extraction run only when those sites are open.`,
  tabs: `Reload Gmail tabs after an extension update so users get the latest content scripts without manually restarting Chrome.`,
  'host permission': `connectintel.net — CRM APIs (lead match, capture, email draft/send, audit log). mail.google.com — Gmail thread widget. linkedin.com — profile capture. Other https pages — optional contact-page capture when the user clicks Add to pipeline.`,
  'remote code': `The extension does not download or execute remote JavaScript. It only calls HTTPS JSON APIs on connectintel.net using the user's existing web-app session. All business logic runs on Connect Intel servers.`,
}

async function waitForDashboard(page, timeoutMs = 300_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const url = page.url()
    if (url.includes('/edit/') && !url.includes('accounts.google.com')) return true
    if (url.includes('accounts.google.com')) {
      process.stdout.write('\r→ Sign in to invite@connectintel.net in the browser…')
    }
    await page.waitForTimeout(1500)
  }
  return false
}

async function fillByLabel(page, labelPattern, text) {
  const textarea = page.locator('textarea').filter({ has: page.getByText(labelPattern, { exact: false }) })
  if ((await textarea.count()) > 0) {
    await textarea.first().fill(text)
    return true
  }
  const row = page.locator('[class*="permission"], tr, div').filter({ hasText: labelPattern }).first()
  if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
    const ta = row.locator('textarea').first()
    if (await ta.isVisible({ timeout: 1000 }).catch(() => false)) {
      await ta.fill(text)
      return true
    }
  }
  return false
}

const browser = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: { width: 1400, height: 900 },
})
const page = browser.pages()[0] || (await browser.newPage())

console.log('\nFilling CWS Privacy tab for Connect Intel…')
await page.goto(privacyUrl, { waitUntil: 'domcontentloaded' })
if (!(await waitForDashboard(page))) {
  console.error('\nTimed out — sign in and re-run: npm run extension:privacy-fill')
  await browser.close()
  process.exit(1)
}
console.log('\n')

// Single purpose
for (const label of [/single purpose/i, /purpose description/i]) {
  const field = page.getByLabel(label).or(page.locator('textarea').filter({ has: page.getByText(label) }))
  if (await field.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await field.first().fill(SINGLE_PURPOSE)
    console.log('✓ Single purpose')
    break
  }
}

// Try generic textarea near "single purpose" heading
const purposeHeading = page.getByText(/single purpose/i).first()
if (await purposeHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
  const ta = purposeHeading.locator('xpath=ancestor::*[1]//textarea | following::textarea[1]').first()
  if (await ta.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ta.fill(SINGLE_PURPOSE)
    console.log('✓ Single purpose (fallback)')
  }
}

// Permission justifications — fill all textareas on page with matching nearby labels
const body = await page.locator('body').innerText()
for (const [key, text] of Object.entries(JUSTIFICATIONS)) {
  const re = new RegExp(key.replace(' ', '.*'), 'i')
  if (!re.test(body) && key !== 'host permission' && key !== 'remote code') continue

  const label = page.getByText(new RegExp(key, 'i')).first()
  if (await label.isVisible({ timeout: 2000 }).catch(() => false)) {
    const ta = label.locator('xpath=ancestor::tr[1]//textarea | ancestor::*[contains(@class,"row")][1]//textarea | following::textarea[1]').first()
    if (await ta.isVisible({ timeout: 1500 }).catch(() => false)) {
      await ta.fill(text)
      console.log(`✓ ${key}`)
      continue
    }
  }
}

// Fill any empty justification textareas in permission section
const permissionSection = page.locator('text=/justification|permission/i').first()
if (await permissionSection.isVisible({ timeout: 3000 }).catch(() => false)) {
  const emptyTextareas = page.locator('textarea')
  const count = await emptyTextareas.count()
  const texts = Object.values(JUSTIFICATIONS)
  let ti = 0
  for (let i = 0; i < count && ti < texts.length; i++) {
    const ta = emptyTextareas.nth(i)
    const val = await ta.inputValue().catch(() => 'x')
    if (!val || val.length < 10) {
      await ta.fill(texts[ti])
      ti++
    }
  }
  if (ti > 0) console.log(`✓ Filled ${ti} permission justification field(s)`)
}

// Privacy policy URL if empty
const policyInput = page.getByLabel(/privacy policy/i).or(page.locator('input[type="url"]')).first()
if (await policyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
  const v = await policyInput.inputValue().catch(() => '')
  if (!v.includes('connectintel.net')) {
    await policyInput.fill('https://connectintel.net/privacy.html')
    console.log('✓ Privacy policy URL')
  }
}

// Certification checkbox
const certify = page.getByRole('checkbox').filter({ has: page.getByText(/certif|comply|policy/i) })
const certCount = await certify.count()
for (let i = 0; i < certCount; i++) {
  const cb = certify.nth(i)
  if (!(await cb.isChecked().catch(() => true))) {
    await cb.check()
    console.log('✓ Certification checkbox')
  }
}

// Save
const save = page.getByRole('button', { name: /save/i }).first()
if (await save.isVisible({ timeout: 5000 }).catch(() => false)) {
  await save.click()
  await page.waitForTimeout(2000)
  console.log('✓ Saved draft')
}

console.log('\nReview the Privacy tab, fix any empty red fields, then click Submit for review.')
console.log(privacyUrl)
await page.waitForTimeout(5000)
await browser.close()
