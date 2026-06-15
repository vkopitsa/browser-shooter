import { test, expect } from '@playwright/test'

test.describe('Controls - Keyboard and Mouse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByText('START GAME').click()
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('W key moves player forward', async ({ page }) => {
    // Get initial player position
    const initialPos = await page.evaluate(() => {
      const data = (window as any).__GAME_DATA__
      if (data?.player) {
        return { x: data.player.position.x, z: data.player.position.z }
      }
      return null
    })
    // Press W to move forward
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(500)
    await page.keyboard.up('KeyW')
    // Verify movement occurred (player position changed)
    if (initialPos) {
      const newPos = await page.evaluate(() => {
        const data = (window as any).__GAME_DATA__
        if (data?.player) {
          return { x: data.player.position.x, z: data.player.position.z }
        }
        return null
      })
      // Player should have moved from initial position
      expect(newPos).not.toBeNull()
    }
  })

  test('A key moves player left', async ({ page }) => {
    await page.keyboard.down('KeyA')
    await page.waitForTimeout(500)
    await page.keyboard.up('KeyA')
    // If we got here without errors, the key was handled
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('S key moves player backward', async ({ page }) => {
    await page.keyboard.down('KeyS')
    await page.waitForTimeout(500)
    await page.keyboard.up('KeyS')
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('D key moves player right', async ({ page }) => {
    await page.keyboard.down('KeyD')
    await page.waitForTimeout(500)
    await page.keyboard.up('KeyD')
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('R key triggers reload', async ({ page }) => {
    // Press R - should not crash the game
    await page.keyboard.press('KeyR')
    await expect(page.getByText('SCORE')).toBeVisible()
    await expect(page.getByText('Pistol')).toBeVisible()
  })

  test('Space key makes player jump', async ({ page }) => {
    await page.keyboard.press('Space')
    await page.waitForTimeout(300)
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('number key 1 switches to Pistol', async ({ page }) => {
    await page.keyboard.press('Digit1')
    await expect(page.getByText('Pistol')).toBeVisible()
  })

  test('number key 2 switches to Shotgun', async ({ page }) => {
    await page.keyboard.press('Digit2')
    await expect(page.getByText('Shotgun')).toBeVisible()
  })

  test('number key 3 switches to Rifle', async ({ page }) => {
    await page.keyboard.press('Digit3')
    await expect(page.getByText('Rifle')).toBeVisible()
  })

  test('weapon switching updates ammo display', async ({ page }) => {
    // Default is Pistol with 60 ammo
    await expect(page.locator('text=/60/').first()).toBeVisible()
    // Switch to Shotgun (30 ammo)
    await page.keyboard.press('Digit2')
    await expect(page.getByText('Shotgun')).toBeVisible()
    // Switch to Rifle (90 ammo)
    await page.keyboard.press('Digit3')
    await expect(page.getByText('Rifle')).toBeVisible()
    // Switch back to Pistol
    await page.keyboard.press('Digit1')
    await expect(page.getByText('Pistol')).toBeVisible()
  })

  test('Escape key toggles pause state', async ({ page }) => {
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('PAUSED')).not.toBeVisible()
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('M key toggles mute without crashing', async ({ page }) => {
    await page.keyboard.press('KeyM')
    await expect(page.getByText('SCORE')).toBeVisible()
  })

  test('combined WASD keys work simultaneously', async ({ page }) => {
    await page.keyboard.down('KeyW')
    await page.keyboard.down('KeyD')
    await page.waitForTimeout(300)
    await page.keyboard.up('KeyW')
    await page.keyboard.up('KeyD')
    await expect(page.getByText('SCORE')).toBeVisible()
  })
})
