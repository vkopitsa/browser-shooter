# Fix: Planetary Mode Shooting Animations Missing

**Date:** 2026-06-28
**Status:** Approved

## Summary

In planetary mode, shooting produces no local feedback — the gun model never shows recoil, there's no muzzle flash, no gunshot sound, no crosshair bloom/recoil, and the gun model doesn't change when you buy or switch weapons. Damage and hits work fine (the session fires the weapon), but it feels like a dead gun because none of the visual/audio feedback that the main game (`App.tsx`) has is wired up in `PlanetaryMode.tsx`.

This fix adds full shooting feedback parity with the main game.

## Root Cause

`PlanetaryMode.tsx` (line 290) calls `viewmodel.update(dt, false)` every frame, which handles bob/recoil decay, but **never calls `viewmodel.fire()`** when a shot is fired. Additionally, planetary mode never creates a `ParticleSystem` or `SoundEffects`, so there is no system to produce muzzle flash or play audio. The crosshair is a static HTML overlay that never reacts to firing, and the buy handler doesn't sync the viewmodel's weapon model.

Compare to `App.tsx` lines 1111-1118, which after `session.step()`:
1. Detects a shot fired this frame (`fireTimer > fireRate - dt`)
2. Calls `viewmodel.fire()` — kick animation
3. Plays gunshot audio via `audio.playWeaponShoot(...)`
4. Spawns muzzle flash via `particleSystem.muzzleFlash(...)`

We replicate this exact pattern in planetary mode.

## Design

### Section 1 — Create feedback systems in the engine-ready callback

In `PlanetaryMode.tsx`, inside `engine.onReady(...)`, after the viewmodel is created (currently line 116-117), create `ParticleSystem` and `SoundEffects` parented to the engine's scene:

```ts
const particleSystem = new ParticleSystem(engine.scene)
const audio = new SoundEffects(new AudioManager())
```

Store these in new refs:
- `const particleSystemRef = useRef<ParticleSystem | null>(null)`
- `const audioRef = useRef<SoundEffects | null>(null)`

This matches how `App.tsx` creates them at lines 817-818. Both systems init lazily.

### Section 2 — Detect "fired this frame" + apply feedback

In the loop, after `session.step(dt)` is called and events are processed, replicate the fire-feedback block from `App.tsx`:

```ts
// Player fire feedback: weapon fired this frame iff step() reset fireTimer to fireRate - dt
let firedThisFrame = false
const weapon = session.weaponManager.current
if (!session.player.isDead && input.shoot && weapon.fireTimer > weapon.def.fireRate - dt) {
  firedThisFrame = true
  viewmodel.fire()
  audio.playWeaponShoot(weaponVisual(weapon.type), session.player.position)
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(engine.camera.quaternion)
  particleSystem.muzzleFlash(session.player.position.clone().add(fwd), fwd)
}
```

The `input.shoot` variable is already available (it's the merged touch + keyboard shoot flag computed at lines 131-143).

### Section 3 — Crosshair bloom

The crosshair is a static HTML overlay (the four `#0f0` lines at lines 430-440). Add crosshair bloom that grows/shrinks based on movement, jumping, and firing — matching the main mode's dynamic crosshair.

1. Add state: `const [bloom, setBloom] = useState(0)`
2. After computing `firedThisFrame`, advance bloom:
```ts
setBloom(stepBloom(bloom, dt, {
  moving: Math.hypot(session.player.velocity.x, session.player.velocity.z) > 1.5,
  airborne: !session.player.isGrounded,
  shotsFired: firedThisFrame ? 1 : 0,
  weaponSpread: weapon.def.spread,
}))
```
3. Apply bloom to the crosshair gap — multiply the line offsets by `(1 + (bloom * BLOOM_PIXELS) / 20)` so the four lines spread apart as bloom grows. The base offsets are `±20px` (horizontal) and `±10px` (vertical), so at full bloom (2.2) with `BLOOM_PIXELS=14` the gap grows by ~31%.

### Section 4 — Weapon model sync on buy / switch

Two places need `viewmodel.setWeapon(...)`:

**Buy handler** (lines 405-419) — after `applyItem(...)` resolves, sync the model:
```ts
viewmodel.setWeapon(weaponVisual(session.weaponManager.current.type))
```

**Weapon cycle (desktop)** — add to the existing `handleKeyDown` effect a `KeyQ` handler:
```ts
} else if (e.code === 'KeyQ') {
  if (sessionRef.current) {
    const wm = sessionRef.current.weaponManager
    wm.cycleNext()
    viewmodel.setWeapon(weaponVisual(wm.current.type))
  }
}
```
And for mobile, wire `onCycleWeapon` on `<TouchControls>` (line 548) to do the same:
```ts
onCycleWeapon={() => {
  if (!sessionRef.current) return
  const wm = sessionRef.current.weaponManager
  wm.cycleNext()
  viewmodel.setWeapon(weaponVisual(wm.current.type))
}}
```
Also update `hudState.weaponName` via `setHudState` so the weapon name label in the HUD matches the new gun.

### Section 5 — Audio listener position

Each frame, after updating the player position, sync the audio listener so 3D positional audio works:
```ts
audio.updateListenerPosition(p.x, p.y, p.z)
audio.updateListenerOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0)
```
where `fwd` is the camera forward vector already computed for muzzle flash. This matches `App.tsx`'s use of `updateListenerPosition`.

### Section 6 — Cleanup

In the effect cleanup (lines 297-304), dispose of the created systems:
```ts
particleSystemRef.current?.clear()
```
`ParticleSystem` exposes `clear()` (not `dispose()`) which removes all live particles/impacts/explosions/tracers from the scene and disposes their geometries/materials. `AudioManager` has no dispose method — its `AudioContext` is a browser singleton that doesn't need explicit teardown. The scene teardown in `engine.dispose()` handles the rest.

### Imports added to PlanetaryMode.tsx

```ts
import { ParticleSystem } from '../effects/ParticleSystem'
import { SoundEffects } from '../audio/SoundEffects'
import { AudioManager } from '../audio/AudioManager'
import { weaponVisual } from '../weapons/WeaponDefs'
import { stepBloom, BLOOM_PIXELS } from '../weapons/CrosshairBloom'
```

## Files Changed

- `src/planetary/PlanetaryMode.tsx` — the only file modified

## Verification

1. **Desktop recoil + flash:** Enter planetary mode, click to shoot — gun model should kick back (rotate + translate), yellow muzzle flash should appear in front of the camera, gunshot sound should play.
2. **Crosshair bloom:** Fire — crosshair lines should spread apart and converge back over ~0.3s. Running/jumping should also widen the gap.
3. **Buy weapon sync:** Open buy menu (B), buy a rifle — gun model should change from pistol to longer rifle model, HUD weapon name should update.
4. **Cycle weapon (Q):** Press Q — gun model should cycle between primary and secondary.
5. **Mobile:** Touch shoot should produce the same recoil + flash (muzzle flash position is computed from camera quaternion, works for both input modes).
6. **Regression:** Main game mode (`App.tsx`) unchanged — its shooting feedback unaffected.
7. **Tests:** `npm run test` and `npm run lint` pass; `npm run build` succeeds.
