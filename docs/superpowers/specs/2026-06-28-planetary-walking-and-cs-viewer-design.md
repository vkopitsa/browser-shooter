# Planetary Mode: Fix Walking & Add CS Mode Viewer

Date: 2026-06-28
Status: Draft

## Problem

Two issues reported by the user:

1. **Cannot walk in planetary mode** — After selecting a drop location on the map, WASD keys don't move the player. The `GeoControls` class correctly reads key input and moves the MapLibre map camera, but never forwards that input to the `GameSession`. The session's player entity stays at `[0, 0, 0]` while the map moves, so bots don't react and collision is wrong.

2. **Cannot view CS-style gameplay from planetary mode** — There is no way to see how the regular CS-style competitive mode looks/behaves without exiting to the main menu and restarting the game.

## Root Cause Analysis

### Issue 1: Walking

The game loop in `PlanetaryMode.tsx` (line 71-104):

```
controls.update(dt)       // moves MapLibre map center based on WASD
session.step(dt)          // advances GameSession — but NO input was applied
```

`GameSession.step()` calls `player.update(dt, input, ...)` for each player. For the local player (`LOCAL_ID`), it reads input via `this.getInput(entity.id)`. But `session.applyInput()` is never called in the planetary loop — so the input is the default `emptyInput()` (all movement flags false).

Meanwhile, `GeoControls` already tracks which keys are pressed (`this.keys` Set). It just never exposes them to the session.

### Issue 2: Mode Viewing

Planetary mode is a separate React component (`PlanetaryMode`) rendered when `gameState === 'planetary'`. CS-style gameplay lives in `App.tsx`'s `'playing'` state with the `GameEngine` (Three.js) renderer. There is currently no bridge between them.

## Design

### Section 1: Fix Walking (Input Plumbing)

**Approach:** Add a `getInput()` method to `GeoControls` that returns a `PlayerInput` matching the key state. Call `session.applyInput()` in the game loop before `session.step()`.

**Changes to `GeoControls.ts`:**
- Add import for `PlayerInput` and `emptyInput` from `../session/protocol`
- Add public method `getInput(): PlayerInput` that returns:
  ```ts
  return {
    ...emptyInput(),
    forward: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
    backward: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
    left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
    right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
  }
  ```

**Changes to `PlanetaryMode.tsx` game loop:**
- After `controls.update(dt)`, before `session.step(dt)`:
  ```ts
  const input = controls.getInput()
  input.yaw = engine.map.getBearing()
  input.pitch = engine.map.getPitch()
  session.applyInput(session.localId, input)
  ```

This makes the session player entity move in sync with the map camera. Bots will react to the player's logical position, and collision works correctly.

### Section 2: CS Mode Viewer Button

**Approach:** Add a `[V] View CS Mode` button to the planetary mode HUD. Clicking it exits planetary and transitions to the existing `'playing'` state (CS-style competitive mode).

**Changes to `PlanetaryMode.tsx`:**
- Add a new button in the top-right area (next to existing Map and Exit buttons):
  ```tsx
  <button onClick={onExit} style={{ ...existingStyle, top: 56 }}>
    [V] View CS Mode
  </button>
  ```
- `onExit` calls `updateGameState('menu')` in `App.tsx`. From the menu, the user clicks "Play" → CS mode starts.

**No changes to `App.tsx`** — it already handles `'playing'` state with full CS-style gameplay (arena, weapons, economy, bots, bombsites).

**Alternative considered:** A seamless toggle (V swaps between modes without menu). Rejected because:
- Requires keeping both engines (MapLibre + Three.js) alive simultaneously — risk of WebGL context conflicts
- Significant complexity for a "nice to have" feature
- The menu transition is already fast (2 clicks)

### Section 3: Scope & Constraints

- **No new dependencies** — all changes use existing code paths
- **No changes to `GameSession`** — the session already supports player movement via `applyInput()`
- **No changes to `App.tsx`** — planetary mode is self-contained
- **Backwards compatible** — existing planetary behavior (map picker, teleport, bots) is unchanged

## Files Modified

| File | Change |
|------|--------|
| `src/planetary/GeoControls.ts` | Add `getInput()` method |
| `src/planetary/PlanetaryMode.tsx` | Call `session.applyInput()` in game loop; add `[V] View CS Mode` button |

## Testing Plan

1. **Walking test:** Enter planetary mode → pick drop location → press W/A/S/D → verify the player entity moves (bots react, collision with buildings works)
2. **Mode switch test:** Click `[V] View CS Mode` → verify transition to menu → click Play → verify CS mode loads correctly
3. **Regression test:** Verify existing planetary features still work (map picker, teleport, round boundary)
4. **Build check:** `npm run build` passes, `npm run lint` passes
