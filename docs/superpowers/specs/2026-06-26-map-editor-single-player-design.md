# Map Editor in Single Player — Design

**Date:** 2026-06-26

## Problem

The 3D map editor is only reachable via the multiplayer flow (Menu → Multiplayer → Host → MatchSetup → Create/Edit Map). Single-player users cannot create or use custom maps.

## Solution

Add a "Custom Maps" section to `TeamSelect` — the screen already shown before single-player starts. Mirrors the existing MatchSetup UI pattern.

## Changes

### `src/ui/TeamSelect.tsx`

- Add props:
  - `onCreateMap: () => void`
  - `onEditMap: (map: SavedMap) => void`
- Extend `onSelect` to `(team: Team, zoneId: string, customZone?: ZoneDef) => void`
- Add local state: `myMaps` (loaded from `loadMaps()`), `customZone: ZoneDef | undefined`
- Add `selectCustomMap(m: SavedMap)` helper: sets `zoneId='custom'`, `customZone=m.zone`
- Render a "Custom Maps" section below the built-in zone buttons:
  - Empty state: "No custom maps yet — create one."
  - Per map: name button (selects it) + Edit button
  - "+ Create" button → `onCreateMap()`
- When team card is clicked, call `onSelect(team, zoneId, customZone)`

### `src/App.tsx`

- Add `mapEditorReturn` ref (`useRef<'mpmenu' | 'teamselect'>('mpmenu')`) — mirrors `settingsReturnRef` pattern
- `TeamSelect.onSelect` handler: also sets `matchConfig.customZone` when provided
- Wire `TeamSelect` props:
  - `onCreateMap`: set `mapEditorReturn.current = 'teamselect'`, clear `editingMap`, `updateGameState('mapeditor')`
  - `onEditMap`: same but set `editingMap` first
- `MapEditor.onSave` / `onCancel`: branch on `mapEditorReturn.current`:
  - `'mpmenu'`: existing behavior (go to mpmenu + showMatchSetup)
  - `'teamselect'`: clear `editingMap`, `updateGameState('teamselect')`

## Data flow

```
TeamSelect → onCreateMap → mapeditor → onSave → teamselect
TeamSelect → onEditMap(map) → mapeditor → onSave → teamselect
TeamSelect.onSelect(team, 'custom', customZone) → matchConfig.customZone = customZone → startGame()
```

## Out of scope

- Upload from file in single player (can be added later if needed)
- Refreshing the map list after returning from editor — `myMaps` state in TeamSelect will reinitialise when the component remounts
