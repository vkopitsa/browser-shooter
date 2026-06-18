# Grenade Feature Design

**Date:** 2026-06-18
**Status:** Approved

---

## Overview

Add CS-style grenades (HE, Flashbang, Smoke) with physics-based throwing, area effects, and full multiplayer sync. All three grenade types are purchasable from the store, thrown with left/right click for long/short toss, and affect both players and enemies.

## Goals

- Three grenade types: HE Grenade, Flashbang, Smoke Grenade
- Physics-based projectile throwing with wall bouncing
- Two throw modes: long throw (left-click) and short toss (right-click)
- Area-of-effect damage/blind/smoke on detonation
- Buy from store with carry limits
- Full multiplayer sync (host authoritative)
- Mobile touch controls support
- Visual and audio feedback for all grenade actions

---

## Grenade Types & Stats

| Grenade | Price | Carry Limit | Long Throw Speed | Short Throw Speed | Fuse Timer | Effect Radius |
|---------|-------|-------------|------------------|-------------------|------------|---------------|
| HE Grenade | $300 | 1 | 25 m/s | 12 m/s | 2.5s | 10m |
| Flashbang | $200 | 2 | 25 m/s | 12 m/s | 1.5s | 8m |
| Smoke Grenade | $300 | 1 | 20 m/s | 10 m/s | 2s | 6m |

### HE Grenade

- Center (0-2m): 100 damage (instant kill)
- Mid (2-5m): 50-100 damage (linear falloff)
- Edge (5-10m): 0-50 damage (linear falloff)
- Beyond 10m: No damage
- Damages players AND enemies, respects friendly fire config

### Flashbang

- Full blind (0-4m): 5 seconds of white screen
- Partial blind (4-8m): 2-3 seconds, scales with distance
- Facing away: Immune (dot product of player look direction and grenade direction < 0)
- Enemies affected same as players
- Visual overlay: Screen fades to white, then fades back

### Smoke Grenade

- Deployment: Sphere appears, grows to 6m radius over 0.5s
- Duration: 15 seconds total, fades out over last 3 seconds
- Line of sight: Any ray passing through the smoke sphere is blocked
- Movement: Players/enemies can walk through (no collision)
- Rendering: Semi-transparent gray sphere with animated edges

---

## Throw Mechanics & Physics

### Input

- **4 key:** Select HE Grenade
- **5 key:** Select Flashbang
- **6 key:** Select Smoke Grenade
- **G key:** Cycle through available grenades → weapon → grenades
- **Left-click:** Long throw (full strength arc)
- **Right-click:** Short toss (underhand, ~40% strength)
- **R key:** Cancel to weapon (while grenade selected)
- **Mobile:** Touch grenade icon in HUD to select, throw button for long throw, double-tap throw button for short toss

### Physics Simulation

- Grenade is a small sphere mesh (0.15m radius) traveling in a parabolic arc
- Gravity: 9.8 m/s²
- Wall/floor bounce: 0.4 coefficient of restitution
- Maximum bounces: 3, then settles on ground
- Metallic bounce sound (quieter with each bounce)
- Slight ground roll after settling

### Detonation

- HE/Flash: Explode on fuse timer (2.5s / 1.5s), NOT on impact
- Smoke: Deploys on fuse timer (2s)
- Visual cue: small blink/pulse on grenade model starting 0.5s before detonation

---

## Visual & Audio Effects

### Grenade Models (placeholder geometry)

- **HE Grenade:** Olive drab cylinder (0.15m x 0.08m), metallic material
- **Flashbang:** White/silver cylinder with red stripe (0.15m x 0.06m)
- **Smoke Grenade:** Green cylinder (0.15m x 0.08m)

### Explosion Effects

- **HE:** Reuses existing `createExplosion()` system with red/orange particles + flash, scale 1.2
- **Flashbang:** Bright white flash (PointLight intensity 20, distance 15), no particles, screen goes white briefly
- **Smoke:** Opaque gray sphere mesh (6m radius) with animated opacity, particle wisps at edges

### Audio

- Throw sound: metallic "clink" (shared for all grenades)
- HE detonation: loud boom (louder than weapon shots)
- Flashbang detonation: high-pitched "pop" + ringing
- Smoke deploy: hissing/deployment sound
- Bounce: subtle metallic tap

---

## Inventory, Store & Controls

### Store Integration

- Grenades added to `STORE_CATALOG` as new `ItemKind: 'grenade'`
- Buy menu shows grenades in a new "Grenades" tab
- Carry limits enforced: 1 HE, 2 Flash, 1 Smoke

### Inventory System

- New `GrenadeManager` class tracks owned grenades per player
- Grenades separate from weapon slots (don't replace primary/secondary)
- When grenade selected, viewmodel shows grenade in hand
- After throwing, auto-switches back to last weapon

### HUD Changes

- Show grenade inventory icons below weapon info
- Highlight selected grenade
- Show remaining count for flashbangs

---

## Network Protocol & Multiplayer Sync

### New Protocol Events

```typescript
| { type: 'grenadeThrown'; playerId: string; grenadeType: 'he' | 'flash' | 'smoke';
    position: Vec3; velocity: Vec3; id: string }

| { type: 'grenadeUpdate'; id: string; position: Vec3; rotation: Vec3; bounces: number }

| { type: 'grenadeDetonated'; id: string; position: Vec3; grenadeType: 'he' | 'flash' | 'smoke';
    affectedPlayers: string[] }

| { type: 'grenadeExpired'; id: string }
```

### Snapshot Extension

```typescript
interface Snapshot {
  // ... existing fields
  grenades: GrenadeState[]
}

interface GrenadeState {
  id: string
  type: 'he' | 'flash' | 'smoke'
  position: Vec3
  velocity: Vec3
  rotation: Vec3
  bounces: number
  fuseTimer: number
  thrownBy: string
}
```

### Sync Strategy

- **Host authoritative:** Host simulates all grenade physics
- **Clients:** Receive grenade thrown event, render grenade mesh locally
- **Position updates:** Host broadcasts grenade positions every 3 ticks (~100ms)
- **Detonation:** Host sends detonation event, clients play the effect
- **Flash blindness:** Host calculates affected players, sends targeted events

---

## Architecture & File Changes

### New Files

| File | Purpose |
|------|---------|
| `src/weapons/Grenade.ts` | Grenade class — physics, fuse timer, bounce logic |
| `src/weapons/GrenadeManager.ts` | Player grenade inventory management |
| `src/weapons/GrenadeDefs.ts` | Grenade type definitions |
| `src/weapons/GrenadeModel.ts` | 3D model creation for each grenade type |
| `src/effects/SmokeCloud.ts` | Smoke grenade cloud effect |
| `src/effects/FlashEffect.ts` | Flashbang blind effect |

### Modified Files

| File | Changes |
|------|---------|
| `src/types.ts` | Add `GrenadeType`, extend `ItemKind` to include `'grenade'` |
| `src/weapons/StoreCatalog.ts` | Add grenade items to store |
| `src/weapons/Viewmodel.ts` | Add grenade throw animation state |
| `src/player/Controls.ts` | Add 4/5/6/G keybindings, right-click for short throw |
| `src/session/GameSession.ts` | Add grenade simulation in step(), handle throws |
| `src/session/protocol.ts` | Add grenade events to SessionEvent, grenade state to Snapshot |
| `src/App.tsx` | Wire grenade inventory to HUD, handle events, mobile controls |
| `src/ui/HUD.tsx` | Show grenade inventory icons |
| `src/ui/TouchControls.tsx` | Add grenade selector + throw button for mobile |
| `src/audio/SoundEffects.ts` | Add grenade sounds |
| `src/effects/ParticleSystem.ts` | Add smoke cloud rendering |

---

## Implementation Order

1. GrenadeDefs + Grenade class (core physics)
2. GrenadeModel + GrenadeManager (3D + inventory)
3. Store integration + keybindings
4. GameSession integration (single-player)
5. Effects (Explosion, Flash, Smoke)
6. HUD + Viewmodel updates
7. Network protocol + multiplayer sync
8. Mobile controls
9. Audio
10. Testing

---

## Testing Strategy

- Unit tests for Grenade physics simulation (trajectory, bounce, detonation)
- Unit tests for GrenadeManager inventory logic
- Unit tests for damage/effect calculations
- Integration test for throw → bounce → detonate → damage flow
- E2E test for buying grenade, throwing, and seeing effect
- Multiplayer sync test for grenade visibility across clients
