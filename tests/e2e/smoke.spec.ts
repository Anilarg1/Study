import { test, expect } from '@playwright/test'

const TEST_EMAIL    = process.env.E2E_EMAIL    ?? ''
const TEST_PASSWORD = process.env.E2E_PASSWORD ?? ''

test.describe('Critical path smoke', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'E2E_EMAIL and E2E_PASSWORD env vars required')

  test('sign in → timer → session → stats → sign out', async ({ page }) => {
    // 1. Navigate to app → login page shown
    await page.goto('/')
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

    // 2. Sign in with test credentials
    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    await page.getByLabel(/password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    // 3. Timer page loads, subject picker visible
    await expect(page).toHaveURL('/')
    await expect(page.locator('.timer-wrap')).toBeVisible()

    // 4. Start a session via the new session modal
    await page.getByRole('button', { name: /new session/i }).first().click()
    await expect(page.locator('.modal')).toBeVisible()
    await page.getByRole('button', { name: /start/i }).click()

    // 5. Fast-forward time so the session completes immediately
    await page.clock.install()
    await page.clock.fastForward('01:00')

    // 6. XP toast should appear
    await expect(page.locator('[class*="toast"], [class*="xp"]')).toBeVisible({ timeout: 5000 })

    // 7. Navigate to /stats → KPI row shows > 0 total minutes
    await page.goto('/stats')
    await expect(page.locator('.s-kpi-value')).not.toContainText('0m')

    // 8. Sign out → redirected to login
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })
})
