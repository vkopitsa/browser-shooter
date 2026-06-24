# Zone Rename Design

**Date:** 2026-06-24
**Goal:** Remove all CS-derived naming from the game's level system. Replace the concept "map" with "zone" and replace the five CS-named levels with original names.

---

## Concept Rename: `map` → `zone`

### Type / interface renames (`src/zones/ZoneDef.ts`)

| Old | New |
|---|---|
| `MapDef` | `ZoneDef` |
| `MapStructure` | `ZoneStructure` |
| `MapBombsite` | `ZoneBombsite` |
| `MapLighting` | `ZoneLighting` |

### Registry renames (`src/zones/registry.ts`)

| Old | New |
|---|---|
| `MAPS` | `ZONES` |
| `getMap(id?)` | `getZone(id?)` |
| `DEFAULT_MAP_ID` | `DEFAULT_ZONE_ID` |

### Property renames (session, net, UI)

| Old | New |
|---|---|
| `MatchConfig.mapId` | `MatchConfig.zoneId` |
| All `mapId` prop/variable references | `zoneId` |

### UI label renames

| Old | New |
|---|---|
| `MAP` (section label in MatchSetup) | `ZONE` |
| `CHOOSE YOUR MAP` (TeamSelect heading) | `CHOOSE YOUR ZONE` |

---

## File Renames

### Source files

| Old path | New path | Exported const |
|---|---|---|
| `src/maps/MapDef.ts` | `src/zones/ZoneDef.ts` | — |
| `src/maps/registry.ts` | `src/zones/registry.ts` | — |
| `src/maps/buildings.ts` | `src/zones/buildings.ts` | — |
| `src/maps/dust2.ts` | `src/zones/arid.ts` | `DUST2 → ARID` |
| `src/maps/mirage.ts` | `src/zones/haze.ts` | `MIRAGE → HAZE` |
| `src/maps/inferno.ts` | `src/zones/ember.ts` | `INFERNO → EMBER` |
| `src/maps/nuke.ts` | `src/zones/reactor.ts` | `NUKE → REACTOR` |
| `src/maps/overpass.ts` | `src/zones/crossing.ts` | `OVERPASS → CROSSING` |

### Test files

| Old path | New path |
|---|---|
| `src/maps/buildings.test.ts` | `src/zones/buildings.test.ts` |
| `src/maps/dust2.test.ts` | `src/zones/arid.test.ts` |
| `src/maps/registry.test.ts` | `src/zones/registry.test.ts` |

---

## Zone Display Names

Each zone's `name` and `description` fields are updated to match the new identity:

| Zone file | `id` | `name` | Description (short) |
|---|---|---|---|
| `arid.ts` | `arid` | `Arid` | Desert combat zone |
| `haze.ts` | `haze` | `Haze` | Sun-bleached urban district |
| `ember.ts` | `ember` | `Ember` | Industrial heat zone |
| `reactor.ts` | `reactor` | `Reactor` | Nuclear facility |
| `crossing.ts` | `crossing` | `Crossing` | Urban bridge sector |

---

## Default Zone

`DEFAULT_ZONE_ID = 'arid'` (was `'dust2'`).

---

## Files Touched

| File | Change |
|---|---|
| `src/maps/*` (8 files) | Deleted — replaced by `src/zones/*` |
| `src/zones/*` (8 files) | Created |
| `src/session/MatchConfig.ts` | `mapId → zoneId` |
| `src/session/MatchConfig.test.ts` | `mapId → zoneId`, default id `'dust2' → 'arid'` |
| `src/session/GameSession.ts` | `getMap → getZone`, import path |
| `src/session/GameSession.map.test.ts` | import path, zone id strings |
| `src/engine/Arena.ts` | import path (`MapDef → ZoneDef`) |
| `src/engine/__tests__/Arena.test.ts` | import path |
| `src/engine/GameEngine.ts` | import path |
| `src/engine/__tests__/GameEngine.test.ts` | import path |
| `src/App.tsx` | `getMap → getZone`, `mapId → zoneId`, import path |
| `src/ui/MatchSetup.tsx` | `MAPS → ZONES`, `mapId → zoneId`, label `MAP → ZONE`, import path |
| `src/ui/TeamSelect.tsx` | `MAPS → ZONES`, `mapId → zoneId`, heading, import path |
| `src/ui/__tests__/TeamSelect.test.tsx` | import path, symbols |
| `src/ui/__tests__/MatchSetup.test.tsx` | import path, symbols |
| `e2e/bomb-objective.spec.ts` | Any `mapId` / map string references |
| `e2e/game.spec.ts` | Any `mapId` / map string references |
| `e2e/ui.spec.ts` | Any `mapId` / map string references |
