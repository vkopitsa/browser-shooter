# Multiplayer Bots & Player-Display Design

Date: 2026-06-16

## Problem

Three issues in multiplayer play:

1. **Bots auto-spawn in multiplayer.** `WaveManager` always runs inside
   `GameSession.step()`, so enemy waves spawn in every mode. There is no way to
   play multiplayer without bots. A `GameMode = 'coop' | 'pvp'` type exists but
   is hardcoded to `'coop'` and gates nothing.
2. **No way to add bots on demand.** Bots only arrive through automatic wave
   progression; the host cannot summon them deliberately.
3. **Other players render wrong in 3D.** Remote player models appear broken in
   multiplayer. Root cause: every player — local and remote — spawns at the
   hardcoded origin `(0, 2, 0)` (`Player.ts:16`). All models pile up at the
   center, and a remote player spawns exactly where the local camera sits, so it
   clips into the viewer's face until players walk apart.

## Goals

- Multiplayer games start with **no** auto-spawning bots.
- The **host** can spawn a full wave of bots on demand with the **G** hotkey.
- Remote players are visibly separated in the 3D world (no stacking / camera
  clipping).
- Single-player behavior is unchanged.

## Non-Goals (YAGNI)

- No multiplayer menu / lobby changes.
- No `coop` / `pvp` mode-selection UI.
- No client-initiated bot spawning (host-only).
- No changes to single-player wave behavior.
- No spawn-protection, team spawn zones, or respawn logic.

## Design

### Part 1 — No auto-bots in multiplayer

Add an `auto` flag to `WaveManager`, defaulting to `true`.

- `auto === true` (single-player): unchanged. Auto-starts wave 1 and
  auto-advances to the next wave when the current one is cleared.
- `auto === false` (multiplayer host): never auto-starts and never
  auto-advances. It still drains an already-queued wave's spawn queue and keeps
  updating existing enemies, so a manually summoned wave behaves normally.
- New method `WaveManager.spawnNextWave()` enqueues the next wave on demand,
  reusing the same enqueue logic the automatic advance uses.

Wiring: in `App.tsx` `startNetGame('host')`, set
`session.waveManager.auto = false`. The single-player path leaves `auto` at its
`true` default. Clients do not step the session, so no gating is needed there.

### Part 2 — Host hotkey **G** spawns a full wave

In `App.tsx` `handleKeyDown`, add a branch: when `e.code === 'KeyG'`, the game
state is `playing`, and `data.role === 'host'`, call
`session.waveManager.spawnNextWave()`.

- Host-only. Clients pressing **G** do nothing (clients have no authoritative
  session to spawn into).
- `G` (`KeyG`) is currently unbound and is clear of the existing binds
  (WASD / Space / Tab / B / Esc / M / R / 1-2).

### Part 3 — Fix the remote-player display (spawn dispersion)

In `GameSession.addPlayer()`, assign each new player a distinct spawn position
instead of relying on `Player`'s hardcoded `(0, 2, 0)`. Place players evenly on
a circle of radius roughly one-third of `ARENA_SIZE`, indexed by join order, at
the existing spawn height (`y = 2`). This removes the stacking and the
camera-clipping, so remote models appear at separated, sensible positions.

`RemotePlayer.pushState()` already snaps a model to its first received position,
so dispersed spawns will be reflected immediately on clients.

## Testing

- **Vitest — WaveManager**
  - With `auto = false`, `update()` does not start wave 1 and does not advance
    to the next wave after the current is cleared.
  - `spawnNextWave()` enqueues the next wave's enemies.
  - Existing single-player auto-progression tests still pass (regression guard).
- **Vitest — GameSession spawn dispersion**
  - Two `addPlayer()` calls produce players at distinct positions.
  - `getSnapshot()` reflects those distinct positions.
- **Manual run** (systematic-debugging / verify): confirm remote players no
  longer stack at center or clip into the local camera in a real two-instance
  multiplayer session.

## Affected files

- `src/enemies/WaveManager.ts` — `auto` flag, `spawnNextWave()`, gated
  auto-progression.
- `src/session/GameSession.ts` — spawn dispersion in `addPlayer()`.
- `src/player/Player.ts` — allow an injected spawn position (remove reliance on
  hardcoded origin) if needed for dispersion.
- `src/App.tsx` — set `waveManager.auto = false` on host start; add **G**
  hotkey handler.
- Test files under `src/enemies/__tests__/` and `src/session/__tests__/`.
