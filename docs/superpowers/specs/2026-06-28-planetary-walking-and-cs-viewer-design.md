# Planetary Mode: Full CS-Style Gameplay on Real Map

Date: 2026-06-28
Status: Approved

## Vision

Planetary mode = the exact same gameplay as multiplayer/competitive CS-style mode, but rendered on top of a real-world map (MapLibre).

- Same `GameSession` logic: weapons, economy, bots, bombsites, rounds, collision
- Same rendering: Three.js scene, viewmodel, remote players, particles, HUD
- **Difference**: the ground is a real-world map (MapLibre tiles) instead of a flat Three.js arena

## Architecture

```
┌─────────────────────────────────────────────────┐
│ HTML Overlay: HUD, Crosshair, Buy Menu, Scoreboard │
├─────────────────────────────────────────────────┤
│ Three.js Scene: players, bots, effects, viewmodel  │
│   ↕ custom layer (projection matrix from MapLibre) │
├─────────────────────────────────────────────────┤
│ MapLibre Canvas: real-world map tiles (ground)     │
└─────────────────────────────────────────────────┘
```

### Coordinate System

- Origin: player's drop location = GameSession origin (0, 0, 0)
- Scale: real-world 1:1 (meters)
- X → east (lng), Z → south (lat, negated for Three.js)
- Conversion via `offsetLngLat()` from `geoUtils.ts`

### Game Loop

```
1. GeoControls reads WASD → map camera moves
2. getInput() → session.applyInput(localId, input)
3. session.step(dt) → player moves, bots AI, combat resolves
4. Sync Three.js camera to player position + map bearing/pitch
5. Render bots/effects in Three.js scene
6. Update HUD state from session snapshot
```

## Implementation Plan

### Phase 1: Input & Movement

**`src/planetary/GeoControls.ts`:**
- Add `getInput(): PlayerInput` method
- Import `PlayerInput`, `emptyInput` from `../session/protocol`

**`src/planetary/PlanetaryMode.tsx` game loop:**
- After `controls.update(dt)`, call `session.applyInput(session.localId, input)`
- Set `input.yaw` from map bearing, `input.pitch` from map pitch

### Phase 2: Full Game Session Wiring

**`src/planetary/PlanetaryMode.tsx`:**
- Initialize session with competitive config (already done)
- Enable round manager: set state to `Buying`, start buy phase timer
- Add economy display (money in HUD)
- Wire buy menu (press B → `BuyMenu` component)
- Wire scoreboard (Tab → show team scores)
- Wire kill feed from session events

### Phase 3: Combat & Rendering

**`src/planetary/PlanetaryEngine.ts`:**
- Add bot character models to scene (reuse `RemotePlayer` or `buildCharacter`)
- Add viewmodel (first-person gun) parented to camera
- Add particle system for muzzle flash, blood, explosions
- Sync scene camera to match MapLibre view each frame

**`src/planetary/PlanetaryMode.tsx`:**
- Handle shooting: left click → `session.weaponManager.current.shoot()` → `session.fireWeapon()` → events
- Render bot positions from session snapshot
- Update weapon HUD (ammo, weapon name) from `session.weaponManager.current`

### Phase 4: Objectives & Round Flow

- Bombsites: place 2-3 bombsite zones near spawn points (reuse `Bombsite` class)
- Bomb plant/defuse: same keybinds (5 to plant, E to defuse)
- Round end: show winner, award economy, next round after delay
- Match end: show scores, option to restart or exit

### Phase 5: Mode Switching

- Add `[V] View CS Mode` button to planetary HUD
- On click: dispose planetary engine, transition to `'playing'` state
- App.tsx handles the rest (existing CS mode flow)

## Key Design Decisions

1. **Self-contained**: PlanetaryMode manages its own session/rendering, doesn't modify App.tsx's `'playing'` flow
2. **Reuse existing systems**: `GameSession`, `WeaponManager`, `RoundManager`, `Economy`, `Bombsite` — all already implemented
3. **No network**: Planetary mode is single-player with bots only (no P2P multiplayer on map)
4. **Arena size**: Use a reasonable real-world area (e.g., 2000m × 2000m around drop point) mapped to the map

## Files Modified

| File | Change |
|------|--------|
| `src/planetary/GeoControls.ts` | Add `getInput()` method |
| `src/planetary/PlanetaryMode.tsx` | Full game loop rewrite: input, combat, economy, rounds, HUD |
| `src/planetary/PlanetaryEngine.ts` | Add bot rendering, viewmodel, particle system support |
| `src/planetary/RoundBoundary.ts` | (if needed) adapt for real-world distances |

## Testing

1. Walk with WASD → map moves, player entity moves, bots react
2. Shoot → ammo decreases, muzzle flash, bots take damage, kill feed shows
3. Buy menu (B) → can purchase weapons/armor, money decreases
4. Round flow: buy phase → active → bomb plant → round end → next round
5. Mode switch: [V] → menu → Play → CS mode works normally
6. `npm run build` + `npm run lint` pass
