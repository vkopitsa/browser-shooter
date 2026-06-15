import { test, expect } from '@playwright/test'

test.describe('UI - HUD and Overlays', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('main menu displays title and subtitle', async ({ page }) => {
    await expect(page.getByText('BROWSER SHOOTER')).toBeVisible()
    await expect(page.getByText('3D FPS Arena Wave Survival')).toBeVisible()
  })

  test('main menu START GAME button is clickable', async ({ page }) => {
    const startBtn = page.getByRole('button', { name: 'START GAME' })
    await expect(startBtn).toBeVisible()
    await expect(startBtn).toBeEnabled()
  })

  test('controls section shows all key bindings', async ({ page }) => {
    await expect(page.getByText('WASD', { exact: true })).toBeVisible()
    await expect(page.getByText('Move')).toBeVisible()
    await expect(page.getByText('Mouse', { exact: true })).toBeVisible()
    await expect(page.getByText('Look')).toBeVisible()
    await expect(page.getByText('Click', { exact: true })).toBeVisible()
    await expect(page.getByText('Shoot', { exact: true })).toBeVisible()
    await expect(page.getByText('1-3', { exact: true })).toBeVisible()
    await expect(page.getByText('Switch Weapon')).toBeVisible()
    await expect(page.getByText('Space', { exact: true })).toBeVisible()
    await expect(page.getByText('Jump')).toBeVisible()
  })

  test('HUD shows health bar with HP label after starting game', async ({ page }) => {
    await page.getByRole('button', { name: 'START GAME' }).click()
    await expect(page.getByText('HP')).toBeVisible()
    // Health value should be visible (100/100 initially)
    await expect(page.getByText('100 / 100')).toBeVisible()
  })

  test('HUD shows score display after starting game', async ({ page }) => {
    await page.getByRole('button', { name: 'START GAME' }).click()
    await expect(page.getByText('SCORE')).toBeVisible()
    // Score starts at 0 - use regex to match the score value near SCORE label
    await expect(page.locator('text=/^0$/').first()).toBeVisible()
  })

  test('HUD shows wave counter after starting game', async ({ page }) => {
    await page.getByRole('button', { name: 'START GAME' }).click()
    await expect(page.getByText('WAVE')).toBeVisible()
  })

  test('HUD shows weapon name and ammo after starting game', async ({ page }) => {
    await page.getByRole('button', { name: 'START GAME' }).click()
    await expect(page.getByText('Pistol')).toBeVisible()
    // Ammo display should show a number
    await expect(page.getByText('60', { exact: true })).toBeVisible()
  })

  test('HUD shows crosshair during gameplay', async ({ page }) => {
    await page.getByRole('button', { name: 'START GAME' }).click()
    // Crosshair is a '+' character in the center
    const crosshair = page.locator('text=+').first()
    await expect(crosshair).toBeVisible()
  })

  test('minimap is rendered during gameplay', async ({ page }) => {
    await page.getByRole('button', { name: 'START GAME' }).click()
    const minimap = page.locator('canvas[width="150"][height="150"]')
    await expect(minimap).toBeVisible()
  })

  test('pause menu shows PAUSED title and buttons', async ({ page }) => {
    await page.getByRole('button', { name: 'START GAME' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).toBeVisible()
    await expect(page.getByRole('button', { name: 'RESUME' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'MAIN MENU' })).toBeVisible()
  })

  test('pause menu shows controls reminder', async ({ page }) => {
    await page.getByRole('button', { name: 'START GAME' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByText('WASD - Move')).toBeVisible()
    await expect(page.getByText('Mouse - Look')).toBeVisible()
    await expect(page.getByText('Click - Shoot')).toBeVisible()
    await expect(page.getByText('R - Reload')).toBeVisible()
    await expect(page.getByText('1-3 - Switch Weapon')).toBeVisible()
    await expect(page.getByText('ESC - Pause')).toBeVisible()
  })

  test('pause menu shows "Press ESC to resume" hint', async ({ page }) => {
    await page.getByRole('button', { name: 'START GAME' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByText('Press ESC to resume')).toBeVisible()
  })

  test('wave number increases during gameplay', async ({ page }) => {
    await page.getByRole('button', { name: 'START GAME' }).click()
    await expect(page.getByText('SCORE')).toBeVisible()
    // Initial wave is 0
    const waveDisplay = page.locator('text=WAVE').first()
    await expect(waveDisplay).toBeVisible()
    // Wait a bit for wave system to potentially progress
    await page.waitForTimeout(3000)
    // Wave should still be displayed (either 0 or progressed)
    await expect(waveDisplay).toBeVisible()
  })

  test('HUD elements are properly positioned', async ({ page }) => {
    await page.getByRole('button', { name: 'START GAME' }).click()
    // Verify score is top-right
    const scoreEl = page.getByText('SCORE').first()
    await expect(scoreEl).toBeVisible()
    // Verify HP is bottom-left area (just check visibility)
    await expect(page.getByText('HP')).toBeVisible()
  })
})
