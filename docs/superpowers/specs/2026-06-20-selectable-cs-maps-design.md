# Selectable CS Maps — Design

**Date:** 2026-06-20
**Status:** Approved (proceeding to implementation)

## Goal

Add five stylized recreations of iconic Counter-Strike maps — **Dust2, Mirage,
Inferno, Nuke, Overpass** — and let the host pick the map when creating a room.
The choice is fixed for the match and synced to all players.

## Decisions (from brainstorming)

- **Fidelity:** Stylized essence. Recognizable layouts (bombsites A/B, a mid lane,
  key chokepoints) built from the existing AABB block system, not pixel-accurate.
- **Roster:** Dust2, Mirage, Inferno, Nuke, Overpass.
- **Selection scope:** Create Room only. No mid-game switching, no solo picker.
- **Baseline:** The current hardcoded arena becomes **Dust2** (the default map),
  preserving existing behavior as the default selection.

## Architecture — data-driven maps

A new `src/maps/` module turns map geometry into data keyed by a `mapId` that
flows through the existing `MatchConfig` → `NetHost` `welcome` sync path.

### `MapDef`

```ts
type StructureMaterial = 'wall' | 'crate' | 'concrete'
interface MapStructure { center: [x,y,z]; size: [w,h,d]; material: StructureMaterial }
interface MapBombsite  { id: 'A' | 'B'; center: [x, z] }
interface MapDef {
  id: string; name: string; description: string
  arenaSize: number          // half-extent; all 5 maps use 30 to match ARENA_SIZE
  floorColor: number
  lighting: { ambientColor, ambientIntensity, sunColor, sunIntensity, sunPosition }
  structures: MapStructure[]
  ctSpawns: [x, z][]; tSpawns: [x, z][]
  bombsites: MapBombsite[]    // exactly 2 (A, B)
}
```

- `src/maps/dust2.ts … overpass.ts` — one `MapDef` each.
- `src/maps/registry.ts` — `MAPS: MapDef[]`, `DEFAULT_MAP_ID = 'dust2'`,
  `getMap(id?): MapDef` (falls back to Dust2 for unknown/undefined ids).

All maps keep `arenaSize = 30` so the existing `ARENA_SIZE` movement clamp and
wave logic are untouched (out of scope to make arena size dynamic).

## Refactors (behavior-preserving)

- **`Arena.ts`**: `createArena(scene, map = getMap())` builds floor, perimeter
  walls, structures, bombsite rings, and lighting from the `MapDef` into a named
  `THREE.Group` (`cs-arena`) added to the scene. New `rebuildArena(scene, map)`
  removes/disposes the existing `cs-arena` group, then calls `createArena`.
  Returns the `CollisionWorld` as before.
- **`Spawns.ts`**: `pickSpawn(team, map = getMap(), index?)` reads
  `map.ctSpawns / map.tSpawns`.
- **`GameSession`**: stores `this.map = getMap(config.mapId)`; builds competitive
  bombsites from `map.bombsites`; passes `this.map` to `pickSpawn`.
- **`MatchConfig`**: add optional `mapId?: string`; defaults set `mapId: 'dust2'`.

## Map selection UI

`MatchSetup.tsx` gains a MAP section: a row of selectable cards (name +
one-line description) consistent with the existing controls. Selected `mapId`
is included in the config passed to `onConfirm`.

## Networking / sync

`MatchConfig` is already serialized to clients in the `welcome` message, so
`mapId` propagates automatically. On match start the arena is rebuilt from
`data.matchConfig.mapId` for host, client, and solo so everyone renders the
same geometry and shares the same `CollisionWorld` shape.

## Arena rebuild lifecycle

The arena is currently built once on mount and carried into each new session via
`fresh.collisionWorld = data.session.collisionWorld`. We add `rebuildArena`
calls at:

- `hostGame(config)` — rebuild to `config.mapId` after creating the session.
- `startNetGame('client')` — rebuild to `data.matchConfig.mapId` (host's map).
- `startGame()` (solo) — rebuild to `data.matchConfig.mapId` (default Dust2).

## Testing

- `registry.test.ts`: all 5 maps present; `getMap` falls back to Dust2 for
  unknown/undefined; every `MapDef` has ≥1 spawn per team and exactly 2
  bombsites (A and B); `arenaSize === 30`.
- `Arena.test.ts`: updated to traverse the `cs-arena` group; still asserts 2
  bombsite ring markers; `rebuildArena` leaves a single arena group.
- `Spawns.test.ts`: updated to the `(team, map, index)` signature; still asserts
  opposite-side spawns and index cycling.

## Out of scope

Mid-game map switching, solo-flow map picker, dynamic arena size, vertical
multi-floor geometry.
