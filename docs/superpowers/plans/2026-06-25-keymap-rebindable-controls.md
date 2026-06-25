# Keymap / Rebindable Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players remap all keyboard gameplay bindings to any key (CS-style capture), persisted in localStorage alongside existing settings.

**Architecture:** Add a `Keymap` type + `DEFAULT_KEYMAP` to `Settings.ts`; `Controls.ts` accepts the keymap at construction and replaces hardcoded `switch` cases with if-checks against keymap values; a new `KeybindsScreen` component handles CS-style key capture; `SettingsMenu` gets a "KEYBINDS →" button; `App.tsx` adds `'keybinds'` game state and passes `settings.keymap` to Controls.

**Tech Stack:** TypeScript, React 18, Vitest, localStorage.

## Global Constraints

- All `KeyboardEvent.code` strings used (e.g. `"KeyW"`, `"Space"`, `"BracketLeft"`)
- No new npm dependencies
- Mouse buttons (left = shoot / long-throw, right = short-throw) are NOT remappable
- Keymap stored inside existing `browser-shooter-settings` localStorage key
- `DEFAULT_KEYMAP` must mirror current hardcoded values exactly so existing players see no change

---

### Task 1: Keymap data model in `Settings.ts`

**Files:**
- Modify: `src/settings/Settings.ts`
- Modify: `src/settings/__tests__/Settings.test.ts`

**Interfaces:**
- Produces: `Keymap` interface, `DEFAULT_KEYMAP` constant, updated `Settings` interface with `keymap: Keymap`, updated `loadSettings` that deep-merges keymap

---

- [ ] **Step 1: Write failing tests**

Add to `src/settings/__tests__/Settings.test.ts` (after the existing imports, add `DEFAULT_KEYMAP` to the import line):

```ts
import { loadSettings, saveSettings, mobileControlsActive, DEFAULT_SETTINGS, DEFAULT_KEYMAP } from '../Settings'
```

Then add these tests at the bottom of the `describe('Settings', ...)` block:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/settings/__tests__/Settings.test.ts
```

Expected: FAIL — `DEFAULT_KEYMAP` not exported, `DEFAULT_SETTINGS.keymap` undefined.

- [ ] **Step 3: Implement `Keymap` + `DEFAULT_KEYMAP` + update `Settings` + `loadSettings`**

Replace the contents of `src/settings/Settings.ts` with:

```ts
import {
  type CrosshairSettings,
  DEFAULT_CROSSHAIR_SETTINGS,
  normalizeCrosshairSettings,
} from './Crosshair'

export type MobileControlsMode = 'auto' | 'on' | 'off'

export interface Keymap {
  forward: string
  backward: string
  left: string
  right: string
  jump: string
  buy: string
  scoreboard: string
  cycleGrenade: string
  selectGrenadeHE: string
  selectGrenadeFlash: string
  selectGrenadeSmoke: string
  pushToTalk: string
  addBotCT: string
  addBotT: string
  removeBot: string
}

export const DEFAULT_KEYMAP: Keymap = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  buy: 'KeyB',
  scoreboard: 'Tab',
  cycleGrenade: 'KeyG',
  selectGrenadeHE: 'Digit4',
  selectGrenadeFlash: 'Digit5',
  selectGrenadeSmoke: 'Digit6',
  pushToTalk: 'KeyK',
  addBotCT: 'BracketLeft',
  addBotT: 'BracketRight',
  removeBot: 'Backslash',
}

export interface Settings {
  /** Display name shown on the scoreboard and to other players. */
  playerName: string
  /** Whether the on-screen touch controls are shown. 'auto' uses touch-device detection. */
  mobileControls: MobileControlsMode
  /** Multiplier applied to touch look speed (1 = default). */
  lookSensitivity: number
  /** Crosshair appearance: global default plus optional per-weapon overrides. */
  crosshair: CrosshairSettings
  /** Keyboard bindings for all gameplay actions. */
  keymap: Keymap
}

const STORAGE_KEY = 'browser-shooter-settings'

export const DEFAULT_SETTINGS: Settings = {
  playerName: 'Player',
  mobileControls: 'auto',
  lookSensitivity: 1,
  crosshair: DEFAULT_CROSSHAIR_SETTINGS,
  keymap: DEFAULT_KEYMAP,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS, crosshair: normalizeCrosshairSettings(undefined) }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      crosshair: normalizeCrosshairSettings(parsed.crosshair),
      keymap: { ...DEFAULT_KEYMAP, ...(parsed.keymap ?? {}) },
    }
  } catch {
    return { ...DEFAULT_SETTINGS, crosshair: normalizeCrosshairSettings(undefined) }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* localStorage unavailable — settings simply won't persist */
  }
}

/** True if the current device reports touch support. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0
}

/** Resolve whether the on-screen touch controls should be active for these settings. */
export function mobileControlsActive(settings: Settings): boolean {
  if (settings.mobileControls === 'on') return true
  if (settings.mobileControls === 'off') return false
  return isTouchDevice()
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/settings/__tests__/Settings.test.ts
```

Expected: all PASS (existing tests still pass; `DEFAULT_SETTINGS` now includes keymap so `toEqual` still holds).

- [ ] **Step 5: Commit**

```bash
git add src/settings/Settings.ts src/settings/__tests__/Settings.test.ts
git commit -m "feat: add Keymap type and DEFAULT_KEYMAP to Settings"
```

---

### Task 2: Wire keymap into `Controls.ts`

**Files:**
- Modify: `src/player/Controls.ts`
- Modify: `src/player/__tests__/Controls.test.ts`

**Interfaces:**
- Consumes: `Keymap` from `src/settings/Settings.ts` (Task 1)
- Produces: `Controls` constructor now accepts optional third param `keymap: Keymap = DEFAULT_KEYMAP`

---

- [ ] **Step 1: Write failing test**

Add this import to `src/player/__tests__/Controls.test.ts`:

```ts
import { DEFAULT_KEYMAP } from '../../settings/Settings'
```

Add this test at the end of the first `describe('Controls', ...)` block (before the closing `})`):

```ts
  it('respects custom keymap — ArrowUp sets forward, KeyW does not', () => {
    controls.destroy()
    const customKeymap = { ...DEFAULT_KEYMAP, forward: 'ArrowUp' }
    controls = new Controls(element, () => 'playing', customKeymap)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    expect(controls.forward).toBe(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))
    expect(controls.forward).toBe(true)
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/player/__tests__/Controls.test.ts
```

Expected: FAIL — `Controls` constructor does not accept a third argument.

- [ ] **Step 3: Rewrite `Controls.ts` to use keymap**

Replace `src/player/Controls.ts` with:

```ts
import { DEFAULT_KEYMAP, type Keymap } from '../settings/Settings'
import type { GameState, Team } from '../types'

export class Controls {
  forward = false
  backward = false
  left = false
  right = false
  jump = false
  shoot = false
  private element: HTMLElement
  private getGameState: () => GameState
  private keymap: Keymap
  private boundKeyDown: (e: KeyboardEvent) => void
  private boundKeyUp: (e: KeyboardEvent) => void
  private boundMouseDown: (e: MouseEvent) => void
  private boundMouseUp: (e: MouseEvent) => void

  onMouseMove: ((e: MouseEvent) => void) | null = null
  onCycleWeapon: (() => void) | null = null
  onToggleStore: (() => void) | null = null
  /** Fired on scoreboard key down (true) / up (false) to show/hide the scoreboard. */
  onScoreboard: ((show: boolean) => void) | null = null
  onThrowGrenade: ((mode: 'long' | 'short') => void) | null = null
  /** Authority-only: add a bot to the given team / remove the last bot. */
  onAddBot: ((team: Team) => void) | null = null
  onRemoveBot: (() => void) | null = null
  onSelectGrenade: ((type: 'he' | 'flash' | 'smoke') => void) | null = null
  onCycleGrenade: (() => void) | null = null
  onIsStoreOpen: (() => boolean) | null = null
  /** True when a grenade is selected; left click then throws instead of firing. */
  onIsGrenadeSelected: (() => boolean) | null = null
  /** Fired on push-to-talk key down / up (hold to transmit voice). */
  onTalkStart: (() => void) | null = null
  onTalkStop: (() => void) | null = null
  private talkHeld = false
  private scoreboardHeld = false

  constructor(element: HTMLElement, getGameState: () => GameState, keymap: Keymap = DEFAULT_KEYMAP) {
    this.element = element
    this.getGameState = getGameState
    this.keymap = keymap

    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e)
    this.boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e)
    this.boundMouseDown = (e: MouseEvent) => this.onMouseDown(e)
    this.boundMouseUp = (e: MouseEvent) => this.onMouseUp(e)

    this.bindEvents()
  }

  private bindEvents() {
    document.addEventListener('keydown', this.boundKeyDown)
    document.addEventListener('keyup', this.boundKeyUp)
    document.addEventListener('mousedown', this.boundMouseDown)
    document.addEventListener('mouseup', this.boundMouseUp)
    document.addEventListener('mousemove', this.boundMouseMove)
    document.addEventListener('pointerlockchange', this.boundPointerLockChange)
  }

  private boundMouseMove = (e: MouseEvent) => {
    if (this.onMouseMove && document.pointerLockElement === this.element) {
      this.onMouseMove(e)
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    const km = this.keymap
    if (e.code === km.forward) { this.forward = true; return }
    if (e.code === km.backward) { this.backward = true; return }
    if (e.code === km.left) { this.left = true; return }
    if (e.code === km.right) { this.right = true; return }
    if (e.code === km.jump) { this.jump = true; return }
    if (e.code === km.scoreboard) {
      e.preventDefault()
      if (!this.scoreboardHeld) { this.scoreboardHeld = true; this.onScoreboard?.(true) }
      return
    }
    if (e.code === km.buy) { e.preventDefault(); this.onToggleStore?.(); return }
    if (e.code === km.selectGrenadeHE) { this.onSelectGrenade?.('he'); return }
    if (e.code === km.selectGrenadeFlash) { this.onSelectGrenade?.('flash'); return }
    if (e.code === km.selectGrenadeSmoke) { this.onSelectGrenade?.('smoke'); return }
    if (e.code === km.cycleGrenade) { this.onCycleGrenade?.(); return }
    if (e.code === km.addBotCT) { this.onAddBot?.('ct'); return }
    if (e.code === km.addBotT) { this.onAddBot?.('t'); return }
    if (e.code === km.removeBot) { this.onRemoveBot?.(); return }
    if (e.code === km.pushToTalk) {
      if (!this.talkHeld) { this.talkHeld = true; this.onTalkStart?.() }
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    const km = this.keymap
    if (e.code === km.forward) { this.forward = false; return }
    if (e.code === km.backward) { this.backward = false; return }
    if (e.code === km.left) { this.left = false; return }
    if (e.code === km.right) { this.right = false; return }
    if (e.code === km.jump) { this.jump = false; return }
    if (e.code === km.scoreboard) {
      e.preventDefault()
      this.scoreboardHeld = false
      this.onScoreboard?.(false)
      return
    }
    if (e.code === km.pushToTalk) {
      this.talkHeld = false
      this.onTalkStop?.()
    }
  }

  private boundPointerLockChange = () => {
    if (document.pointerLockElement !== this.element) {
      this.shoot = false
    }
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      if (this.getGameState() === 'playing' && !this.onIsStoreOpen?.()) {
        if (document.pointerLockElement !== this.element) {
          this.element.requestPointerLock()
        }
        if (this.onIsGrenadeSelected?.()) {
          this.onThrowGrenade?.('long')
        } else {
          this.shoot = true
        }
      }
    }
    if (e.button === 2) {
      if (this.getGameState() === 'playing' && !this.onIsStoreOpen?.()) {
        this.onThrowGrenade?.('short')
      }
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (e.button === 0) {
      this.shoot = false
    }
  }

  getMovement() {
    return {
      forward: this.forward,
      backward: this.backward,
      left: this.left,
      right: this.right,
      jump: this.jump,
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.boundKeyDown)
    document.removeEventListener('keyup', this.boundKeyUp)
    document.removeEventListener('mousedown', this.boundMouseDown)
    document.removeEventListener('mouseup', this.boundMouseUp)
    document.removeEventListener('mousemove', this.boundMouseMove)
    document.removeEventListener('pointerlockchange', this.boundPointerLockChange)
    if (document.pointerLockElement === this.element) {
      document.exitPointerLock()
    }
  }
}
```

- [ ] **Step 4: Run all Controls tests**

```bash
npx vitest run src/player/__tests__/Controls.test.ts
```

Expected: all PASS including the new custom-keymap test.

- [ ] **Step 5: Commit**

```bash
git add src/player/Controls.ts src/player/__tests__/Controls.test.ts
git commit -m "feat: Controls accepts keymap parameter, replaces hardcoded key bindings"
```

---

### Task 3: `KeybindsScreen` component

**Files:**
- Create: `src/ui/KeybindsScreen.tsx`

**Interfaces:**
- Consumes: `Keymap`, `DEFAULT_KEYMAP` from `src/settings/Settings.ts` (Task 1)
- Consumes: `Settings` from `src/settings/Settings.ts`
- Produces: `<KeybindsScreen settings onBack onChange />` component

No unit tests for this task — it is pure UI with no logic branches worth unit-testing. Visual verification in Task 4.

---

- [ ] **Step 1: Create `src/ui/KeybindsScreen.tsx`**

```tsx
import React, { useEffect, useState } from 'react'
import type { Keymap, Settings } from '../settings/Settings'
import { DEFAULT_KEYMAP } from '../settings/Settings'
import { BattlefieldBackground } from './BattlefieldBackground'

interface KeybindsScreenProps {
  settings: Settings
  onChange: (settings: Settings) => void
  onBack: () => void
}

// Maps KeyboardEvent.code to a short human-readable label
function labelFor(code: string): string {
  const labels: Record<string, string> = {
    Space: 'SPACE', Tab: 'TAB', Escape: 'ESC', Enter: 'ENTER',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    BracketLeft: '[', BracketRight: ']', Backslash: '\\',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
    Backquote: '`', Minus: '-', Equal: '=',
    ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
    ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
    AltLeft: 'L-ALT', AltRight: 'R-ALT',
    CapsLock: 'CAPS',
  }
  if (labels[code]) return labels[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}

const GROUPS: { label: string; actions: { key: keyof Keymap; label: string }[] }[] = [
  {
    label: 'MOVEMENT',
    actions: [
      { key: 'forward', label: 'Forward' },
      { key: 'backward', label: 'Backward' },
      { key: 'left', label: 'Left' },
      { key: 'right', label: 'Right' },
      { key: 'jump', label: 'Jump' },
    ],
  },
  {
    label: 'COMBAT',
    actions: [
      { key: 'buy', label: 'Buy Menu' },
      { key: 'scoreboard', label: 'Scoreboard' },
    ],
  },
  {
    label: 'GRENADES',
    actions: [
      { key: 'cycleGrenade', label: 'Cycle Grenade' },
      { key: 'selectGrenadeHE', label: 'HE Grenade' },
      { key: 'selectGrenadeFlash', label: 'Flashbang' },
      { key: 'selectGrenadeSmoke', label: 'Smoke' },
    ],
  },
  {
    label: 'COMMUNICATION',
    actions: [
      { key: 'pushToTalk', label: 'Push to Talk' },
    ],
  },
  {
    label: 'ADMIN',
    actions: [
      { key: 'addBotCT', label: 'Add CT Bot' },
      { key: 'addBotT', label: 'Add T Bot' },
      { key: 'removeBot', label: 'Remove Bot' },
    ],
  },
]

const scroll: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: 12,
  padding: 'calc(28px + var(--safe-top)) 16px calc(28px + var(--safe-bottom))',
  boxSizing: 'border-box', overflowY: 'auto',
  color: 'white', fontFamily: 'monospace',
}

const card: React.CSSProperties = {
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(0,200,80,0.13)',
  borderTop: '2px solid rgba(0,200,80,0.3)',
  borderRadius: 8,
  padding: '18px 20px',
  display: 'flex', flexDirection: 'column', gap: 12,
  width: 'min(400px, calc(100vw - 32px))', boxSizing: 'border-box',
}

const cardLabel: React.CSSProperties = {
  fontSize: 10, color: '#5aff8a', letterSpacing: 2, opacity: 0.75,
  marginBottom: 4,
}

export const KeybindsScreen: React.FC<KeybindsScreenProps> = ({ settings, onChange, onBack }) => {
  const [waiting, setWaiting] = useState<keyof Keymap | null>(null)

  useEffect(() => {
    if (!waiting) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.code === 'Escape') {
        setWaiting(null)
        return
      }
      onChange({ ...settings, keymap: { ...settings.keymap, [waiting]: e.code } })
      setWaiting(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [waiting, settings, onChange])

  const keymap = settings.keymap

  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      <BattlefieldBackground />
      <div style={scroll}>
        <h1 style={{
          fontSize: 'clamp(26px, 8vw, 40px)', fontWeight: 'bold',
          color: '#ff6600', textShadow: '0 0 20px #ff6600, 0 0 40px #ff3300',
          letterSpacing: 4, margin: '0 0 4px',
        }}>KEYBINDS</h1>

        {GROUPS.map((group) => (
          <div key={group.label} style={card}>
            <div style={cardLabel}>{group.label}</div>
            {group.actions.map(({ key, label }) => {
              const isWaiting = waiting === key
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 }}>
                    {label}
                  </span>
                  <button
                    onClick={() => setWaiting(isWaiting ? null : key)}
                    style={{
                      minWidth: 90, padding: '6px 12px',
                      fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13, letterSpacing: 1,
                      background: isWaiting ? 'rgba(255,102,0,0.25)' : 'rgba(255,255,255,0.05)',
                      color: isWaiting ? '#ff6600' : 'rgba(255,255,255,0.8)',
                      border: isWaiting ? '1px solid #ff6600' : '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 6, cursor: 'pointer', textAlign: 'center',
                    }}
                  >
                    {isWaiting ? 'PRESS ANY KEY' : labelFor(keymap[key])}
                  </button>
                </div>
              )
            })}
          </div>
        ))}

        <div style={{ ...card, flexDirection: 'row', gap: 8, padding: '12px 20px' }}>
          <button
            onClick={() => onChange({ ...settings, keymap: DEFAULT_KEYMAP })}
            style={{
              flex: 1, padding: '10px 0',
              fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13, letterSpacing: 1,
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer',
            }}
          >RESET DEFAULTS</button>
          <button
            onClick={onBack}
            style={{
              flex: 1, padding: '10px 0',
              fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13, letterSpacing: 1,
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer',
            }}
          >BACK</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/KeybindsScreen.tsx
git commit -m "feat: add KeybindsScreen component with CS-style key capture"
```

---

### Task 4: Wire navigation — `types.ts`, `SettingsMenu.tsx`, `App.tsx`

**Files:**
- Modify: `src/types.ts` (add `'keybinds'` to `GameState`)
- Modify: `src/ui/SettingsMenu.tsx` (add `onKeybinds` prop + button)
- Modify: `src/App.tsx` (pass keymap to Controls, add keybinds state/render)

**Interfaces:**
- Consumes: `KeybindsScreen` from Task 3
- Consumes: `Keymap` / `DEFAULT_KEYMAP` from Task 1
- Consumes: `Controls` constructor signature from Task 2

---

- [ ] **Step 1: Add `'keybinds'` to `GameState` in `src/types.ts`**

Find this line in `src/types.ts`:
```ts
export type GameState = 'menu' | 'mpmenu' | 'settings' | 'teamselect' | 'playing' | 'paused' | 'gameover' | 'matchover' | 'mapeditor'
```

Replace it with:
```ts
export type GameState = 'menu' | 'mpmenu' | 'settings' | 'keybinds' | 'teamselect' | 'playing' | 'paused' | 'gameover' | 'matchover' | 'mapeditor'
```

- [ ] **Step 2: Add `onKeybinds` prop to `SettingsMenu`**

In `src/ui/SettingsMenu.tsx`, find:
```ts
interface SettingsMenuProps {
  settings: Settings
  onChange: (settings: Settings) => void
  onBack: () => void
}
```

Replace with:
```ts
interface SettingsMenuProps {
  settings: Settings
  onChange: (settings: Settings) => void
  onBack: () => void
  onKeybinds: () => void
}
```

Then find the `onBack` in the component destructuring:
```ts
export const SettingsMenu: React.FC<SettingsMenuProps> = ({ settings, onChange, onBack }) => {
```
Replace with:
```ts
export const SettingsMenu: React.FC<SettingsMenuProps> = ({ settings, onChange, onBack, onKeybinds }) => {
```

Then find the existing BACK button:
```tsx
        <button
          onClick={onBack}
          style={{
            padding: '12px 0', width: 'min(400px, calc(100vw - 32px))',
            fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14, letterSpacing: 2,
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, cursor: 'pointer',
          }}
        >BACK</button>
```

Replace with:
```tsx
        <button
          onClick={onKeybinds}
          style={{
            padding: '12px 0', width: 'min(400px, calc(100vw - 32px))',
            fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14, letterSpacing: 2,
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, cursor: 'pointer',
          }}
        >KEYBINDS →</button>
        <button
          onClick={onBack}
          style={{
            padding: '12px 0', width: 'min(400px, calc(100vw - 32px))',
            fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14, letterSpacing: 2,
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, cursor: 'pointer',
          }}
        >BACK</button>
```

- [ ] **Step 3: Update `App.tsx`**

**3a.** Add `KeybindsScreen` import near the other UI imports:
```ts
import { KeybindsScreen } from './ui/KeybindsScreen'
```

**3b.** Find the Controls construction (around line 710):
```ts
    data.controls = new Controls(container, () => gameStateRef.current)
```
Replace with:
```ts
    data.controls = new Controls(container, () => gameStateRef.current, settingsRef.current.keymap)
```

**3c.** Find the SettingsMenu render (around line 1383):
```tsx
      {gameState === 'settings' && (
        <SettingsMenu
          settings={settings}
          onChange={updateSettings}
          onBack={() => updateGameState('menu')}
        />
      )}
```
Replace with:
```tsx
      {gameState === 'settings' && (
        <SettingsMenu
          settings={settings}
          onChange={updateSettings}
          onBack={() => updateGameState('menu')}
          onKeybinds={() => updateGameState('keybinds')}
        />
      )}

      {gameState === 'keybinds' && (
        <KeybindsScreen
          settings={settings}
          onChange={updateSettings}
          onBack={() => updateGameState('settings')}
        />
      )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/ui/SettingsMenu.tsx src/ui/KeybindsScreen.tsx src/App.tsx
git commit -m "feat: wire KeybindsScreen navigation from Settings, pass keymap to Controls"
```
