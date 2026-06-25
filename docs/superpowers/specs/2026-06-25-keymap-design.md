# Keymap / Rebindable Controls Design

**Date:** 2026-06-25

## Goal

Let players remap all keyboard gameplay bindings to any key, CS-style, and persist the choices across sessions.

## Scope

All keyboard actions are remappable. Mouse buttons (left = shoot / long-throw grenade, right = short-throw grenade) stay hardcoded — they are not part of this feature.

Actions covered: `forward`, `backward`, `left`, `right`, `jump`, `buy`, `scoreboard`, `cycleGrenade`, `selectGrenadeHE`, `selectGrenadeFlash`, `selectGrenadeSmoke`, `pushToTalk`, `addBotCT`, `addBotT`, `removeBot`.

## Data Model

Add a `keymap` field to the existing `Settings` interface in `src/settings/Settings.ts`. Each action maps to a `KeyboardEvent.code` string.

```ts
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
```

`DEFAULT_KEYMAP` mirrors the current hardcoded values exactly, so existing players see no change on first load.

`loadSettings` merges the stored keymap field-by-field (same pattern as `crosshair`), so partial/older blobs get filled in with defaults rather than breaking.

## Controls.ts

`Controls` receives a `keymap: Keymap` parameter at construction (no runtime rebinding needed — the keymap is loaded once at startup). The `onKeyDown`/`onKeyUp` switch statements are replaced with map lookups against `e.code`.

Duplicate bindings (two actions on the same key): first match in the handler wins. Not prevented, not special-cased.

## KeybindsScreen

A new `src/ui/KeybindsScreen.tsx` component with the same visual style as `SettingsMenu` (dark card, monospace, orange headings, green accents).

### Layout

- Title: `KEYBINDS`
- One card per logical group (MOVEMENT, COMBAT, GRENADES, COMMUNICATION, ADMIN)
- Each row: action label left, key button right
- "RESET DEFAULTS" button at bottom of card
- "BACK" button returns to Settings

### Capture flow (CS-style)

1. Player clicks a key button → row enters **waiting** state (button turns orange, shows `PRESS ANY KEY`)
2. Only one row waiting at a time — clicking another row cancels the previous
3. Next `keydown` on `document` (with `e.preventDefault()`): sets the new binding, exits waiting state
4. `Escape` cancels without changing the binding

### Navigation

`SettingsMenu` gets a `KEYBINDS →` button (same style as BACK) that calls a new `onKeybinds` prop to navigate to `KeybindsScreen`. Navigation pattern matches the rest of the app.

## Storage

Keymap is stored as part of the existing `browser-shooter-settings` localStorage key, serialized inside the `Settings` object. No new storage key needed.

## Out of Scope

- Mouse button remapping
- Gamepad support
- Conflict warnings (duplicate key detection UI)
- Per-weapon keybinds
