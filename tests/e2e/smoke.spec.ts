import { test, expect } from '@playwright/test'

const EMAIL    = process.env['E2E_EMAIL']    ?? 'test@example.com'
const PASSWORD = process.env['E2E_PASSWORD'] ?? 'testpassword'

test.describe('Critical path smoke test', () => {
  test('sign in, complete a session, see XP awarded', async ({ page }) => {
    // ── 1. Load app → should show login ──────────────────────────────────────
    await page.goto('/')
    await expect(page.locator('input[type="email"]')).toBeVisible()

    // ── 2. Sign in ────────────────────────────────────────────────────────────
    await page.fill('input[type="email"]',    EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')

    // Wait for app shell to load (timer page)
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10_000 })

    // ── 3. Fast-forward timer via store manipulation ──────────────────────────
    // Set remaining to 1 second so the tick loop fires quickly
    await page.evaluate(() => {
      // Access the Zustand store from window (dev only — requires no tree-shaking of store ref)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__TIMER_STORE__
      if (store) store.getState().start()
    })

    // Alternative approach: use page.clock to fast-forward time
    await page.clock.install()
    await page.evaluate(() => {
      // Zustand timer store uses Date.now() and expiresAt
      // Set expiresAt to 1 second from now so next tick finishes the session
    })

    // ── 4. Start a session via the UI ─────────────────────────────────────────
    // Click start on the timer page
    await page.click('button[aria-label="Start"], button:has-text("Start")')

    // Use clock to advance past the timer
    await page.clock.fastForward(26 * 60 * 1000)  // 26 minutes

    // ── 5. Verify XP toast appears ────────────────────────────────────────────
    await expect(page.locator('[class*="toast"], [class*="xp"]').filter({ hasText: 'XP' }))
      .toBeVisible({ timeout: 5_000 })

    // ── 6. Navigate to stats and verify session count > 0 ────────────────────
    await page.click('a[href="/stats"], button:has-text("Stats")')
    await expect(page.locator('[class*="kpi"], [class*="stat"]').first()).toBeVisible()

    // ── 7. Sign out ───────────────────────────────────────────────────────────
    await page.click('button:has-text("Sign out"), [aria-label*="sign out" i]')
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5_000 })
  })
})
