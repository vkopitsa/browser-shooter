import { describe, it, expect, beforeEach } from 'vitest'
import { loadSettings, saveSettings, mobileControlsActive, DEFAULT_SETTINGS, DEFAULT_KEYMAP } from '../Settings'

describe('Settings', () => {
  beforeEach(() => localStorage.clear())

  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips saved settings', () => {
    const saved = { ...DEFAULT_SETTINGS, playerName: 'Neo', mobileControls: 'on' as const, lookSensitivity: 1.8 }
    saveSettings(saved)
    expect(loadSettings()).toEqual(saved)
  })

  it('fills missing fields from defaults when stored data is partial', () => {
    localStorage.setItem('browser-shooter-settings', JSON.stringify({ playerName: 'Trinity' }))
    const loaded = loadSettings()
    expect(loaded.playerName).toBe('Trinity')
    expect(loaded.mobileControls).toBe(DEFAULT_SETTINGS.mobileControls)
    expect(loaded.lookSensitivity).toBe(DEFAULT_SETTINGS.lookSensitivity)
  })

  it('mobileControlsActive honours explicit on/off regardless of device', () => {
    expect(mobileControlsActive({ ...DEFAULT_SETTINGS, mobileControls: 'on' })).toBe(true)
    expect(mobileControlsActive({ ...DEFAULT_SETTINGS, mobileControls: 'off' })).toBe(false)
  })

  it('default settings include a full keymap', () => {
    expect(DEFAULT_SETTINGS.keymap).toEqual(DEFAULT_KEYMAP)
  })

  it('loadSettings fills missing keymap keys from defaults', () => {
    localStorage.setItem('browser-shooter-settings', JSON.stringify({ playerName: 'Neo' }))
    const loaded = loadSettings()
    expect(loaded.keymap).toEqual(DEFAULT_KEYMAP)
  })

  it('loadSettings merges partial stored keymap with defaults', () => {
    localStorage.setItem(
      'browser-shooter-settings',
      JSON.stringify({ keymap: { forward: 'ArrowUp' } })
    )
    const loaded = loadSettings()
    expect(loaded.keymap.forward).toBe('ArrowUp')
    expect(loaded.keymap.backward).toBe(DEFAULT_KEYMAP.backward)
  })
})
