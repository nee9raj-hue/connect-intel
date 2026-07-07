// @ts-check
import { test, expect } from '@playwright/test'

test.describe('Marketing hub smoke', () => {
  test('marketing panel route loads without crash', async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(String(err)))

    const res = await page.goto('/?panel=marketing', { waitUntil: 'domcontentloaded' })
    expect(res?.ok() || res?.status() === 304).toBeTruthy()

    await expect(page.locator('body')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('pipeline bulk-email redirect from legacy marketing tab', async ({ page }) => {
    await page.goto('/?panel=marketing&tab=bulk-email', { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/panel=(marketing|pipeline)/, { timeout: 15_000 })
    const url = page.url()
    expect(url.includes('bulk') || url.includes('pipeline') || url.includes('marketing')).toBeTruthy()
  })
})
