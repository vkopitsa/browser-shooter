---
name: 3d-map-editor
description: Replace 2D SVG map editor with a full 3D orbit-camera editor using R3F — block placement via floor drag, full transform panel, edit existing maps
metadata:
  type: project
---

# 3D Map Editor

## Summary

Replace the existing 2D SVG `MapEditor` with a full Three.js (via `@react-three/fiber`) 3D editor. The camera orbits freely; snapping overhead gives a 2D-equivalent view. Blocks are placed by dragging on the floor plane and fine-tuned via a properties panel. Existing saved maps are editable via a new "Edit" button in `MatchSetup`.

## Layout

Three columns:
- **Left panel** (180px): map name, arena size buttons, tool/material selector, top-view snap button, stats, clear/download/cancel/save
- **Center**: R3F `<Canvas>` filling remaining space — floor grid, block meshes, spawn markers, bombsite rings, drag-preview box, OrbitControls
- **Right panel** (200px, conditional): appears when a block is selected — X/Y/Z position inputs, W/H/D size inputs, material picker, delete button

## Interaction Model

### Placing blocks
1. Select a material tool in the left panel (Wall, Crate, Concrete, Metal, Wood)
2. Left-click-drag on the floor plane → live preview box shows footprint
3. Mouse-up finalizes the block at default height (wall=3, others=1.5)
4. Block is immediately selected → right panel opens to adjust height and position

### Selecting & editing blocks
- Left-click any existing block → highlights with emissive outline, opens right panel
- Right panel exposes: X, Y, Z (center position), W, H, D (full size), material dropdown, Delete button
- Clicking empty floor deselects

### Camera
- Left-click drag on empty floor: place/drag block (when tool is a material); orbit when no drag is in progress or eraser/spawn tool is active
- Right-click drag: always orbits
- Scroll: zoom
- **"⊤ Top" button**: snaps camera to directly overhead (equivalent to old 2D view)

### Spawns & bombsites
- Select T Spawn / CT Spawn tool → left-click floor → places marker at clicked point
- Select Site A / Site B tool → left-click floor → moves bombsite center
- Eraser tool → left-click any object (block, spawn, bombsite) → removes it

## Architecture

### Files changed
- `src/ui/MapEditor.tsx` — **replaced entirely**
- `src/ui/MapEditorCanvas.tsx` — **new**: R3F Canvas component
- `src/ui/BlockPropertiesPanel.tsx` — **new**: right panel for selected block
- `src/ui/MatchSetup.tsx` — add "Edit" button per map, `onEditMap: (map: SavedMap) => void` prop
- `src/App.tsx` — wire `onEditMap` to pass `initial={map}` to `MapEditor`; add `editingMap` state

### Dependencies added
- `@react-three/fiber` — React renderer for Three.js
- `@react-three/drei` — OrbitControls, line helpers, etc.

### Types unchanged
`ZoneDef`, `ZoneStructure`, `mapStore` — no changes. Height is already `size[1]` in `ZoneStructure`; we just expose it in the UI.

### State ownership
All zone state (`ZoneDef`) lives in `MapEditor`. Passed down as props to `MapEditorCanvas` and `BlockPropertiesPanel`. No new stores.

### Raycasting strategy
- Floor plane: invisible `<mesh>` at y=0 covering the arena, `raycast` against it for placement and spawn placement
- Block selection: each block mesh gets an `onClick` handler; floor click deselects
- Drag detection: `onPointerDown` + `onPointerMove` + `onPointerUp` on the floor mesh; if pointer moves > threshold before up, it's a drag (place block); otherwise it's a click (deselect / place spawn)

## Edit Existing Maps

`MatchSetup` gains an "Edit" button next to each saved map card:
```
[Map Name]    [Select] [Edit]
```
Clicking Edit calls `onEditMap(map)`. `App.tsx` sets `editingMap = map` and transitions to `'mapeditor'` state, passing `initial={editingMap}` to `MapEditor`. On save, map is updated in-place (same ID). The `initial` prop is already accepted by the current `MapEditor` — just never passed.

## Out of Scope
- Undo/redo
- Multi-select
- Copy/paste blocks
- Terrain height maps
