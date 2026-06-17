# Browser Shooter UI Improvements Design Spec

**Date:** 2026-06-17
**Version:** 0.1.0
**Status:** Draft

---

## Overview

Four improvements to the browser-shooter game: fix sound file 404 errors, add weapon icons to buy menu, redesign main menu with About/Help, and fix cursor disappearing on menu screens.

---

## 1. Sound Files Fix

### Problem
Sound files are in `src/audio/sounds/` but AudioManager fetches from `sounds/*.mp3` relative to base URL. This causes 404 errors in production.

### Solution
Move sound files to `public/sounds/` directory. Vite serves `public/` contents at the root, matching AudioManager's expected paths.

### Changes
- Move `src/audio/sounds/*.mp3` → `public/sounds/*.mp3`
- Remove empty `src/audio/sounds/` directory

---

## 2. Buy Menu Icons

### Problem
Buy menu shows items as text-only list. User wants CS-style icons in grid layout.

### Design

#### Icon Set
Create SVG silhouettes for each weapon/item:
- **Pistols**: pistol, usp, glock, deagle
- **Primary**: m4, aug, ak, galil, mp5, shotgun, awp
- **Gear**: kevlar, kevlar_helmet, medkit, boots

#### Layout
- **Desktop (PC)**: 5-column grid
- **Mobile**: 1-column list
- Each cell: icon (64x64) + name + price

#### File Structure
```
src/ui/icons/
  weapons.tsx  (SVG components)
```

#### Implementation
- Add `icon` field to `StoreItem` type
- Update `StoreCatalog.ts` with icon references
- Rewrite `BuyMenu.tsx` with responsive grid

---

## 3. Main Menu Redesign

### Problem
Current menu is horizontal with 3 items. User wants vertical layout with About and Help.

### Design

#### Layout
```
BROWSER SHOOTER
3D FPS Arena Wave Survival

┌─────────────────┐
│  SINGLEPLAYER   │
│  MULTIPLAYER    │
│  SETTINGS       │
│  ABOUT          │
│  HELP           │
└─────────────────┘
```

#### New Menu Items

**About Modal:**
- Version: 0.1.0
- Build: Browser Shooter
- Credits: "Built with Three.js, React, Vite"

**Help Modal:**
- Controls reference (reuse existing controls section from MainMenu)
- Close button

### Changes
- Rewrite `MainMenu.tsx` with vertical layout
- Add `onAbout` and `onHelp` props
- Create `AboutModal.tsx` and `HelpModal.tsx` components
- Update `App.tsx` to handle new menu states

---

## 4. Cursor Fix

### Problem
Clicking anywhere on menu screen triggers `requestPointerLock()`, hiding cursor.

### Root Cause
`Controls.ts:79-81` calls `requestPointerLock()` on mouseDown without checking game state.

### Solution
Pass `gameState` to Controls, only lock pointer when playing.

#### Changes to Controls.ts
```typescript
constructor(element: HTMLElement, getGameState: () => GameState) {
  this.element = element
  this.getGameState = getGameState
  // ...
}

private onMouseDown(e: MouseEvent) {
  if (e.button === 0) {
    this.shoot = true
    if (this.getGameState() === 'playing' && document.pointerLockElement !== this.element) {
      this.element.requestPointerLock()
    }
  }
}
```

#### Changes to App.tsx
```typescript
data.controls = new Controls(container, () => gameStateRef.current)
```

---

## File Changes Summary

| File | Change |
|------|--------|
| `public/sounds/*.mp3` | New location for sound files |
| `src/audio/sounds/` | Delete directory |
| `src/types.ts` | Add `icon` field to StoreItem |
| `src/weapons/StoreCatalog.ts` | Add icon references |
| `src/ui/icons/weapons.tsx` | New SVG icon components |
| `src/ui/BuyMenu.tsx` | Rewrite with grid layout |
| `src/ui/MainMenu.tsx` | Rewrite with vertical layout |
| `src/ui/AboutModal.tsx` | New component |
| `src/ui/HelpModal.tsx` | New component |
| `src/player/Controls.ts` | Add gameState check |
| `src/App.tsx` | Update Controls init, add modal states |

---

## Testing

1. Verify sound files load without 404 errors
2. Test buy menu displays correctly on desktop (5-col) and mobile (1-col)
3. Test main menu vertical layout with all 5 items
4. Test About/Help modals open and close
5. Test cursor remains visible on menu screens
6. Test pointer lock only activates during gameplay

---

## Success Criteria

- [ ] No 404 errors for sound files
- [ ] Buy menu shows weapon icons in grid
- [ ] Main menu has vertical layout with 5 items
- [ ] About shows version + credits
- [ ] Help shows controls reference
- [ ] Cursor visible on menu screens
- [ ] Pointer lock only in gameplay
