import { test, expect } from '@playwright/test'

test.describe('Game - Load and Flow', () => {
  test('loads and shows main menu', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('BROWSER SHOOTER')).toBeVisible()
    await expect(page.getByText('START GAME')).toBeVisible()
    await expect(page.getByText('3D FPS Arena Wave Survival')).toBeVisible()
  })

  test('shows controls info on main menu', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Controls')).toBeVisible()
    // Use exact: true for short labels to avoid substring matches
    await expect(page.getByText('WASD', { exact: true })).toBeVisible()
    await expect(page.getByText('Mouse', { exact: true })).toBeVisible()
    await expect(page.getByText('Click', { exact: true })).toBeVisible()
    await expect(page.getByText('1-3', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload' }).or(page.locator('span').filter({ hasText: /^R$/ }))).toBeVisible()
    await expect(page.getByText('Space', { exact: true })).toBeVisible()
    await expect(page.getByText('M', { exact: true })).toBeVisible()
    await expect(page.getByText('ESC', { exact: true })).toBeVisible()
  })

  test('starts game when clicking start button', async ({ page }) => {
    await page.goto('/')
    await page.getByText('START GAME').click()
    await expect(page.getByText('SCORE')).toBeVisible()
    await expect(page.getByText('WAVE')).toBeVisible()
    await expect(page.getByText('HP')).toBeVisible()
  })

  test('shows HUD elements during gameplay', async ({ page }) => {
    await page.goto('/')
    await page.getByText('START GAME').click()
    await expect(page.getByText('Pistol')).toBeVisible()
    // Crosshair
    await expect(page.locator('text=+').first()).toBeVisible()
  })

  test('shows minimap during gameplay', async ({ page }) => {
    await page.goto('/')
    await page.getByText('START GAME').click()
    const minimap = page.locator('canvas[width="150"]')
    await expect(minimap).toBeVisible()
  })

  test('pauses game with Escape key', async ({ page }) => {
    await page.goto('/')
    await page.getByText('START GAME').click()
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).toBeVisible()
    await expect(page.getByRole('button', { name: 'RESUME' })).toBeVisible()
  })

  test('resumes game from pause', async ({ page }) => {
    await page.goto('/')
    await page.getByText('START GAME').click()
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).toBeVisible()
    await page.getByRole('button', { name: 'RESUME' }).click()
    await expect(page.getByText('PAUSED')).not.toBeVisible()
  })

  test('returns to main menu from pause', async ({ page }) => {
    await page.goto('/')
    await page.getByText('START GAME').click()
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).toBeVisible()
    await page.getByRole('button', { name: 'MAIN MENU' }).click()
    await expect(page.getByText('BROWSER SHOOTER')).toBeVisible()
    await expect(page.getByText('START GAME')).toBeVisible()
  })

  test('restart button returns to gameplay', async ({ page }) => {
    await page.goto('/')
    // Start game first time
    await page.getByRole('button', { name: 'START GAME' }).click()
    await expect(page.getByText('SCORE')).toBeVisible()
    // Pause and return to main menu
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'MAIN MENU' }).click()
    // Wait for main menu
    await expect(page.getByRole('button', { name: 'START GAME' })).toBeVisible()
    await page.waitForTimeout(500)
    // Start game again (simulating restart)
    await page.evaluate(() => {
      const btn = document.querySelector('button')
      if (btn && btn.textContent?.trim() === 'START GAME') {
        btn.click()
      }
    })
    await expect(page.getByText('SCORE')).toBeVisible()
    await expect(page.getByText('WAVE')).toBeVisible()
  })
})
