# 3D Map Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2D SVG MapEditor with a full 3D orbit-camera editor using @react-three/fiber; add block height editing and ability to edit existing saved maps.

**Architecture:** Three files: `MapEditor.tsx` (layout + state owner), `MapEditorCanvas.tsx` (R3F scene with drag placement, block selection, orbiting), `BlockPropertiesPanel.tsx` (right panel with transform inputs). `MatchSetup.tsx` gains an Edit button per map; `App.tsx` wires the `initial` prop through.

**Tech Stack:** React 19, @react-three/fiber ^9, @react-three/drei ^10, Three.js 0.170 (already installed), Vitest + @testing-library/react (existing test setup)

## Global Constraints

- TypeScript strict — no `any` except where THREE type incompatibility forces it (cast via `as unknown as T`)
- No new files beyond the three listed — reuse `ZoneDef`, `ZoneStructure`, `mapStore` unchanged
- `StructureMaterial` values: `'wall' | 'crate' | 'concrete' | 'metal' | 'wood'`
- Default heights: wall=3, others=1.5
- `ZoneStructure.center` = `[x, y, z]` where y is vertical center; `ZoneStructure.size` = `[width, height, depth]`
- Arena coordinate system: origin at center, X = left/right, Z = front/back, Y = up
- Right-click drag = orbit camera; left-click = interact with scene

---

### Task 1: Install deps + wire MatchSetup Edit button + App.tsx

**Files:**
- Modify: `package.json` (deps)
- Modify: `src/ui/MatchSetup.tsx` — add `onEditMap` prop + Edit button
- Modify: `src/App.tsx` — add `editingMap` state, pass `initial` to `MapEditor`
- Test: `src/ui/__tests__/MatchSetup.test.tsx`

**Interfaces:**
- Produces: `MatchSetup` accepts `onEditMap: (map: SavedMap) => void` prop
- Produces: `MapEditor` receives `initial?: SavedMap` (already exists in the component, just never passed from App)

- [ ] **Step 1: Install R3F deps**

```bash
cd /home/user/projects/browser-shooter
npm install @react-three/fiber@^9 @react-three/drei@^10
```

Expected: packages added to node_modules, no peer dep errors.

- [ ] **Step 2: Write failing test for Edit button**

Add to `src/ui/__tests__/MatchSetup.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchSetup } from '../MatchSetup'
import { saveMap } from '../../zones/mapStore'
import type { SavedMap } from '../../zones/mapStore'
import { DAYLIGHT } from '../../zones/ZoneDef'

// --- existing tests stay above ---

describe('MatchSetup edit map', () => {
  const mockMap: SavedMap = {
    id: 'test1', name: 'Test Map', createdAt: 0,
    zone: {
      id: 'z1', name: 'Test Map', description: '', arenaSize: 20,
      floorColor: 0x444444, lighting: DAYLIGHT,
      structures: [], ctSpawns: [[0, -10]], tSpawns: [[0, 10]],
      bombsites: [{ id: 'A', center: [10, 0] }, { id: 'B', center: [-10, 0] }],
    },
  }

  it('calls onEditMap with the map when Edit is clicked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify([mockMap]))
    const onEditMap = vi.fn()
    render(<MatchSetup onConfirm={vi.fn()} onBack={vi.fn()} onCreateMap={vi.fn()} onEditMap={onEditMap} />)
    fireEvent.click(screen.getByText('Edit'))
    expect(onEditMap).toHaveBeenCalledWith(mockMap)
    vi.restoreAllMocks()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- --reporter=verbose MatchSetup
```

Expected: FAIL — `onEditMap` prop not accepted, Edit button not rendered.

- [ ] **Step 4: Add `onEditMap` prop and Edit button to MatchSetup**

In `src/ui/MatchSetup.tsx`, update the props destructure and type:

```tsx
export function MatchSetup({
  onConfirm, onBack, onCreateMap, onEditMap,
}: {
  onConfirm: (c: MatchConfig) => void
  onBack: () => void
  onCreateMap: () => void
  onEditMap: (map: SavedMap) => void
}) {
```

Replace the map card in the `myMaps.map` block (lines ~163-172) with:

```tsx
{myMaps.map((m) => {
  const active = zoneId === 'custom' && customZone?.id === m.zone.id
  return (
    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button onClick={() => selectCustomMap(m)} style={{
        cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left',
        padding: '8px 12px', width: 170, boxSizing: 'border-box',
        background: active ? '#ff6600' : '#1d1d2a', color: active ? '#000' : '#fff',
        border: active ? '1px solid #ff6600' : '1px solid #3a3a55',
      }}>
        <div style={{ fontSize: 14, fontWeight: 'bold' }}>{m.name}</div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 3 }}>{m.zone.arenaSize * 2}×{m.zone.arenaSize * 2} · {m.zone.structures.length} objs</div>
      </button>
      <button style={smallBtn} onClick={() => onEditMap(m)}>Edit</button>
    </div>
  )
})}
```

- [ ] **Step 5: Add `editingMap` state and wire `initial` in App.tsx**

In `src/App.tsx`, after the existing `showMatchSetup` state (~line 163), add:

```tsx
const [editingMap, setEditingMap] = useState<import('./zones/mapStore').SavedMap | undefined>(undefined)
```

Update the `MatchSetup` render block (~lines 1467-1479):

```tsx
{gameState === 'mpmenu' && showMatchSetup && (
  <MatchSetup
    onBack={() => setShowMatchSetup(false)}
    onConfirm={(c) => { setShowMatchSetup(false); void hostGame(c).catch(() => setJoinError('Could not start hosting.')) }}
    onCreateMap={() => { setEditingMap(undefined); setShowMatchSetup(false); updateGameState('mapeditor') }}
    onEditMap={(map) => { setEditingMap(map); setShowMatchSetup(false); updateGameState('mapeditor') }}
  />
)}
{gameState === 'mapeditor' && (
  <MapEditor
    initial={editingMap}
    onSave={() => { setEditingMap(undefined); updateGameState('mpmenu'); setShowMatchSetup(true) }}
    onCancel={() => { setEditingMap(undefined); updateGameState('mpmenu'); setShowMatchSetup(true) }}
  />
)}
```

- [ ] **Step 6: Run tests**

```bash
npm test -- --reporter=verbose MatchSetup
```

Expected: all MatchSetup tests PASS.

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/ui/MatchSetup.tsx src/App.tsx src/ui/__tests__/MatchSetup.test.tsx package.json package-lock.json
git commit -m "feat: install R3F, add edit-map button in MatchSetup, wire App.tsx"
```

---

### Task 2: BlockPropertiesPanel

**Files:**
- Create: `src/ui/BlockPropertiesPanel.tsx`
- Test: `src/ui/__tests__/BlockPropertiesPanel.test.tsx`

**Interfaces:**
- Consumes: `ZoneStructure` from `../zones/ZoneDef`
- Produces: `BlockPropertiesPanel({ structure, onUpdate, onDelete })` — exported named function

- [ ] **Step 1: Write failing test**

Create `src/ui/__tests__/BlockPropertiesPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockPropertiesPanel } from '../BlockPropertiesPanel'
import { DAYLIGHT } from '../../zones/ZoneDef'
import type { ZoneStructure } from '../../zones/ZoneDef'

const wall: ZoneStructure = { center: [0, 1.5, 0], size: [4, 3, 2], material: 'wall' }

describe('BlockPropertiesPanel', () => {
  it('renders X/Y/Z and W/H/D inputs with current values', () => {
    render(<BlockPropertiesPanel structure={wall} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    // 6 number inputs: X=0, Y=1.5, Z=0, W=4, H=3, D=2
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs).toHaveLength(6)
    expect((inputs[0] as HTMLInputElement).value).toBe('0')   // X
    expect((inputs[1] as HTMLInputElement).value).toBe('1.5') // Y
    expect((inputs[3] as HTMLInputElement).value).toBe('4')   // W
    expect((inputs[4] as HTMLInputElement).value).toBe('3')   // H
  })

  it('calls onUpdate with new center when X input changes', () => {
    const onUpdate = vi.fn()
    render(<BlockPropertiesPanel structure={wall} onUpdate={onUpdate} onDelete={vi.fn()} />)
    const xInput = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(xInput, { target: { value: '5' } })
    fireEvent.blur(xInput)
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ center: [5, 1.5, 0] }))
  })

  it('calls onUpdate with new height when H input changes', () => {
    const onUpdate = vi.fn()
    render(<BlockPropertiesPanel structure={wall} onUpdate={onUpdate} onDelete={vi.fn()} />)
    const hInput = screen.getAllByRole('spinbutton')[4]
    fireEvent.change(hInput, { target: { value: '5' } })
    fireEvent.blur(hInput)
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ size: [4, 5, 2] }))
  })

  it('calls onDelete when Delete Block button clicked', () => {
    const onDelete = vi.fn()
    render(<BlockPropertiesPanel structure={wall} onUpdate={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getByText('Delete Block'))
    expect(onDelete).toHaveBeenCalled()
  })

  it('calls onUpdate with new material when dropdown changes', () => {
    const onUpdate = vi.fn()
    render(<BlockPropertiesPanel structure={wall} onUpdate={onUpdate} onDelete={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'crate' } })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ material: 'crate' }))
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --reporter=verbose BlockPropertiesPanel
```

Expected: FAIL — `BlockPropertiesPanel` not found.

- [ ] **Step 3: Create BlockPropertiesPanel**

Create `src/ui/BlockPropertiesPanel.tsx`:

```tsx
import React from 'react'
import type { ZoneStructure, StructureMaterial } from '../zones/ZoneDef'

const MATERIALS: StructureMaterial[] = ['wall', 'crate', 'concrete', 'metal', 'wood']

const inp: React.CSSProperties = {
  width: 64, padding: '4px 6px', fontFamily: 'monospace', fontSize: 12,
  background: '#1d1d2a', color: '#fff', border: '1px solid #3a3a55',
}

export function BlockPropertiesPanel({ structure, onUpdate, onDelete }: {
  structure: ZoneStructure
  onUpdate: (s: ZoneStructure) => void
  onDelete: () => void
}) {
  const [cx, cy, cz] = structure.center
  const [sw, sh, sd] = structure.size

  function set(field: 'cx'|'cy'|'cz'|'sw'|'sh'|'sd', raw: string) {
    const v = parseFloat(raw)
    if (isNaN(v)) return
    if (field === 'cx') onUpdate({ ...structure, center: [v, cy, cz] })
    else if (field === 'cy') onUpdate({ ...structure, center: [cx, v, cz] })
    else if (field === 'cz') onUpdate({ ...structure, center: [cx, cy, v] })
    else if (field === 'sw') onUpdate({ ...structure, size: [Math.max(0.5, v), sh, sd] })
    else if (field === 'sh') onUpdate({ ...structure, size: [sw, Math.max(0.5, v), sd] })
    else if (field === 'sd') onUpdate({ ...structure, size: [sw, sh, Math.max(0.5, v)] })
  }

  const posFields = [
    { f: 'cx' as const, label: 'X', val: cx },
    { f: 'cy' as const, label: 'Y', val: cy },
    { f: 'cz' as const, label: 'Z', val: cz },
  ]
  const sizeFields = [
    { f: 'sw' as const, label: 'W', val: sw },
    { f: 'sh' as const, label: 'H', val: sh },
    { f: 'sd' as const, label: 'D', val: sd },
  ]

  return (
    <div style={{ width: 200, minWidth: 200, background: '#12121e', borderLeft: '1px solid #3a3a55',
      padding: 12, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'monospace', overflowY: 'auto' }}>
      <div style={{ fontSize: 11, opacity: 0.6 }}>BLOCK PROPERTIES</div>

      <div>
        <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>POSITION</div>
        {posFields.map(({ f, label, val }) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, opacity: 0.6, width: 12 }}>{label}</span>
            <input
              style={inp} type="number" step={0.5}
              key={`${f}-${val}`} defaultValue={val}
              onBlur={(e) => set(f, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && set(f, (e.target as HTMLInputElement).value)}
            />
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>SIZE</div>
        {sizeFields.map(({ f, label, val }) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, opacity: 0.6, width: 12 }}>{label}</span>
            <input
              style={inp} type="number" step={0.5} min={0.5}
              key={`${f}-${val}`} defaultValue={val}
              onBlur={(e) => set(f, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && set(f, (e.target as HTMLInputElement).value)}
            />
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>MATERIAL</div>
        <select
          value={structure.material}
          onChange={(e) => onUpdate({ ...structure, material: e.target.value as StructureMaterial })}
          style={{ ...inp, width: '100%', boxSizing: 'border-box' }}
        >
          {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <button
        onClick={onDelete}
        style={{ padding: '6px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
          background: '#3a1010', color: '#ff6060', border: '1px solid #553030' }}
      >
        Delete Block
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --reporter=verbose BlockPropertiesPanel
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/BlockPropertiesPanel.tsx src/ui/__tests__/BlockPropertiesPanel.test.tsx
git commit -m "feat: add BlockPropertiesPanel with position/size/material/delete"
```

---

### Task 3: MapEditorCanvas (3D scene)

**Files:**
- Create: `src/ui/MapEditorCanvas.tsx`
- Test: `src/ui/__tests__/MapEditorCanvas.test.tsx`

**Interfaces:**
- Consumes: `ZoneDef`, `ZoneStructure`, `StructureMaterial` from `../zones/ZoneDef`
- Consumes: `Tool` type — `'wall' | 'crate' | 'concrete' | 'metal' | 'wood' | 'tspawn' | 'ctspawn' | 'bombA' | 'bombB' | 'eraser'`
- Produces: `MapEditorCanvas({ zone, tool, selectedIdx, topSnapRef, onPlaceStructure, onPlaceSpawn, onMoveBombsite, onSelectStructure, onDeleteStructure, onDeleteSpawn })`
- Produces: `TopSnapRef` type — `{ snap: () => void }`

- [ ] **Step 1: Write smoke test**

Create `src/ui/__tests__/MapEditorCanvas.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React, { createRef } from 'react'
import type { TopSnapRef } from '../MapEditorCanvas'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({ camera: { position: { set: vi.fn() }, lookAt: vi.fn() } }),
  useFrame: vi.fn(),
}))
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Grid: () => null,
}))

import { MapEditorCanvas } from '../MapEditorCanvas'
import { DAYLIGHT } from '../../zones/ZoneDef'
import type { ZoneDef } from '../../zones/ZoneDef'

const zone: ZoneDef = {
  id: 'z1', name: 'Test', description: '', arenaSize: 20, floorColor: 0x444444,
  lighting: DAYLIGHT, structures: [], ctSpawns: [[0, -10]], tSpawns: [[0, 10]],
  bombsites: [{ id: 'A', center: [10, 0] }, { id: 'B', center: [-10, 0] }],
}

describe('MapEditorCanvas', () => {
  it('renders without crashing', () => {
    const ref = createRef<TopSnapRef>()
    const { getByTestId } = render(
      <MapEditorCanvas
        zone={zone} tool="wall" selectedIdx={null}
        topSnapRef={{ current: null }}
        onPlaceStructure={vi.fn()} onPlaceSpawn={vi.fn()} onMoveBombsite={vi.fn()}
        onSelectStructure={vi.fn()} onDeleteStructure={vi.fn()} onDeleteSpawn={vi.fn()}
      />
    )
    expect(getByTestId('r3f-canvas')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --reporter=verbose MapEditorCanvas
```

Expected: FAIL — `MapEditorCanvas` not found.

- [ ] **Step 3: Create MapEditorCanvas**

Create `src/ui/MapEditorCanvas.tsx`:

```tsx
import React, { useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { ZoneDef, ZoneStructure, StructureMaterial } from '../zones/ZoneDef'

export type Tool = 'wall' | 'crate' | 'concrete' | 'metal' | 'wood' | 'tspawn' | 'ctspawn' | 'bombA' | 'bombB' | 'eraser'
export type TopSnapRef = { snap: () => void }

const MATERIAL_COLOR: Record<StructureMaterial, string> = {
  wall: '#8b8b8b', crate: '#8b6914', concrete: '#bbbbbb', metal: '#6688aa', wood: '#aa7744',
}
const DEFAULT_HEIGHT: Record<StructureMaterial, number> = {
  wall: 3, crate: 1.5, concrete: 2, metal: 2, wood: 1.5,
}
const STRUCTURE_MATERIALS: StructureMaterial[] = ['wall', 'crate', 'concrete', 'metal', 'wood']

function snapToGrid(v: number) { return Math.round(v * 2) / 2 }

function SceneContent({
  zone, tool, selectedIdx, onPlaceStructure, onPlaceSpawn, onMoveBombsite,
  onSelectStructure, onDeleteStructure, onDeleteSpawn, topSnapRef,
}: {
  zone: ZoneDef; tool: Tool; selectedIdx: number | null
  onPlaceStructure: (s: ZoneStructure) => void
  onPlaceSpawn: (type: 'T' | 'CT', x: number, z: number) => void
  onMoveBombsite: (id: 'A' | 'B', x: number, z: number) => void
  onSelectStructure: (idx: number | null) => void
  onDeleteStructure: (idx: number) => void
  onDeleteSpawn: (type: 'T' | 'CT', idx: number) => void
  topSnapRef: React.MutableRefObject<TopSnapRef | null>
}) {
  const { camera } = useThree()
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const dragStart = useRef<{ x: number; z: number; px: number; pz: number } | null>(null)
  const [dragCur, setDragCur] = useState<{ x: number; z: number } | null>(null)
  const isMaterial = STRUCTURE_MATERIALS.includes(tool as StructureMaterial)

  React.useEffect(() => {
    topSnapRef.current = {
      snap: () => {
        const a = zone.arenaSize
        camera.position.set(0, a * 3, 0.001)
        camera.lookAt(0, 0, 0)
        controlsRef.current?.update()
      },
    }
  }, [camera, zone.arenaSize, topSnapRef])

  function onFloorDown(e: ThreeEvent<PointerEvent>) {
    if (e.button !== 0) return
    e.stopPropagation()
    const x = snapToGrid(e.point.x), z = snapToGrid(e.point.z)
    dragStart.current = { x, z, px: e.nativeEvent.clientX, pz: e.nativeEvent.clientY }
    setDragCur({ x, z })
  }

  function onFloorMove(e: ThreeEvent<PointerEvent>) {
    if (!dragStart.current) return
    setDragCur({ x: snapToGrid(e.point.x), z: snapToGrid(e.point.z) })
  }

  function onFloorUp(e: ThreeEvent<PointerEvent>) {
    const ds = dragStart.current
    dragStart.current = null
    setDragCur(null)
    if (!ds) return

    const dx = e.nativeEvent.clientX - ds.px
    const dz = e.nativeEvent.clientY - ds.pz
    const isDrag = Math.sqrt(dx * dx + dz * dz) > 5
    const x = snapToGrid(e.point.x), z = snapToGrid(e.point.z)

    if (isMaterial) {
      if (isDrag) {
        const ax = Math.min(ds.x, x), bx = Math.max(ds.x, x)
        const az = Math.min(ds.z, z), bz = Math.max(ds.z, z)
        const mat = tool as StructureMaterial
        const h = DEFAULT_HEIGHT[mat]
        onPlaceStructure({
          center: [(ax + bx) / 2, h / 2, (az + bz) / 2],
          size: [Math.max(1, bx - ax), h, Math.max(1, bz - az)],
          material: mat,
        })
      } else {
        onSelectStructure(null)
      }
    } else if (tool === 'tspawn') onPlaceSpawn('T', x, z)
    else if (tool === 'ctspawn') onPlaceSpawn('CT', x, z)
    else if (tool === 'bombA') onMoveBombsite('A', x, z)
    else if (tool === 'bombB') onMoveBombsite('B', x, z)
    else onSelectStructure(null)
  }

  const a = zone.arenaSize

  const preview = (() => {
    if (!dragStart.current || !dragCur || !isMaterial) return null
    const ax = Math.min(dragStart.current.x, dragCur.x), bx = Math.max(dragStart.current.x, dragCur.x)
    const az = Math.min(dragStart.current.z, dragCur.z), bz = Math.max(dragStart.current.z, dragCur.z)
    const mat = tool as StructureMaterial
    const h = DEFAULT_HEIGHT[mat]
    return { cx: (ax + bx) / 2, cz: (az + bz) / 2, w: Math.max(1, bx - ax), d: Math.max(1, bz - az), h, mat }
  })()

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        mouseButtons={{
          LEFT: -1 as unknown as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
      />
      <ambientLight color={zone.lighting.ambientColor} intensity={zone.lighting.ambientIntensity} />
      <directionalLight color={zone.lighting.sunColor} intensity={zone.lighting.sunIntensity}
        position={zone.lighting.sunPosition} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={onFloorDown} onPointerMove={onFloorMove} onPointerUp={onFloorUp}>
        <planeGeometry args={[a * 2, a * 2]} />
        <meshStandardMaterial color={`#${zone.floorColor.toString(16).padStart(6, '0')}`} />
      </mesh>

      {/* Grid */}
      <gridHelper args={[a * 2, Math.round((a * 2) / 5), '#2a2a3a', '#2a2a3a']} position={[0, 0.01, 0]} />

      {/* Arena border */}
      <lineSegments position={[0, 0.02, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(a * 2, 0.01, a * 2)]} />
        <lineBasicMaterial color="#ff6600" />
      </lineSegments>

      {/* Structures */}
      {zone.structures.map((s, i) => (
        <mesh key={i} position={[s.center[0], s.center[1], s.center[2]]}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            tool === 'eraser' ? onDeleteStructure(i) : onSelectStructure(i)
          }}>
          <boxGeometry args={[s.size[0], s.size[1], s.size[2]]} />
          <meshStandardMaterial color={MATERIAL_COLOR[s.material]}
            emissive={MATERIAL_COLOR[s.material]} emissiveIntensity={selectedIdx === i ? 0.4 : 0} />
        </mesh>
      ))}

      {/* Drag preview */}
      {preview && (
        <mesh position={[preview.cx, preview.h / 2, preview.cz]}>
          <boxGeometry args={[preview.w, preview.h, preview.d]} />
          <meshStandardMaterial color={MATERIAL_COLOR[preview.mat]} opacity={0.5} transparent />
        </mesh>
      )}

      {/* T spawns */}
      {zone.tSpawns.map(([x, z], i) => (
        <mesh key={`t${i}`} position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (tool === 'eraser') onDeleteSpawn('T', i) }}>
          <circleGeometry args={[1.5, 16]} />
          <meshBasicMaterial color="#ff8c00" opacity={0.7} transparent />
        </mesh>
      ))}

      {/* CT spawns */}
      {zone.ctSpawns.map(([x, z], i) => (
        <mesh key={`ct${i}`} position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (tool === 'eraser') onDeleteSpawn('CT', i) }}>
          <circleGeometry args={[1.5, 16]} />
          <meshBasicMaterial color="#3c78ff" opacity={0.7} transparent />
        </mesh>
      ))}

      {/* Bombsites */}
      {zone.bombsites.map((b) => (
        <mesh key={b.id} position={[b.center[0], 0.05, b.center[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3, 4, 32]} />
          <meshBasicMaterial color={b.id === 'A' ? '#ff3232' : '#32c832'}
            opacity={0.5} transparent side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  )
}

export function MapEditorCanvas({
  zone, tool, selectedIdx, topSnapRef,
  onPlaceStructure, onPlaceSpawn, onMoveBombsite,
  onSelectStructure, onDeleteStructure, onDeleteSpawn,
}: {
  zone: ZoneDef; tool: Tool; selectedIdx: number | null
  topSnapRef: React.MutableRefObject<TopSnapRef | null>
  onPlaceStructure: (s: ZoneStructure) => void
  onPlaceSpawn: (type: 'T' | 'CT', x: number, z: number) => void
  onMoveBombsite: (id: 'A' | 'B', x: number, z: number) => void
  onSelectStructure: (idx: number | null) => void
  onDeleteStructure: (idx: number) => void
  onDeleteSpawn: (type: 'T' | 'CT', idx: number) => void
}) {
  const a = zone.arenaSize
  const skyHex = `#${(zone.skyColor ?? 0x87ceeb).toString(16).padStart(6, '0')}`
  return (
    <Canvas camera={{ position: [0, a * 1.5, a * 1.5], fov: 60 }} style={{ background: skyHex }}>
      <SceneContent
        zone={zone} tool={tool} selectedIdx={selectedIdx} topSnapRef={topSnapRef}
        onPlaceStructure={onPlaceStructure} onPlaceSpawn={onPlaceSpawn}
        onMoveBombsite={onMoveBombsite} onSelectStructure={onSelectStructure}
        onDeleteStructure={onDeleteStructure} onDeleteSpawn={onDeleteSpawn}
      />
    </Canvas>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --reporter=verbose MapEditorCanvas
```

Expected: smoke test PASS.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. If `three-stdlib` is missing, install it: `npm install three-stdlib` (it's a drei peer dep, usually installed automatically).

- [ ] **Step 6: Commit**

```bash
git add src/ui/MapEditorCanvas.tsx src/ui/__tests__/MapEditorCanvas.test.tsx
git commit -m "feat: add MapEditorCanvas 3D scene with drag placement and block selection"
```

---

### Task 4: New MapEditor.tsx

**Files:**
- Modify: `src/ui/MapEditor.tsx` — replace entirely
- Test: `src/ui/__tests__/MapEditor.test.tsx`

**Interfaces:**
- Consumes: `MapEditorCanvas` from `./MapEditorCanvas`
- Consumes: `BlockPropertiesPanel` from `./BlockPropertiesPanel`
- Consumes: `Tool`, `TopSnapRef` from `./MapEditorCanvas`
- Consumes: `SavedMap` from `../zones/mapStore`
- Consumes: `ZoneDef`, `ZoneStructure` from `../zones/ZoneDef`
- Produces: `MapEditor({ initial?, onSave, onCancel })` — same external signature as before

- [ ] **Step 1: Write failing tests**

Create `src/ui/__tests__/MapEditor.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MapEditor } from '../MapEditor'
import { DAYLIGHT } from '../../zones/ZoneDef'
import type { SavedMap } from '../../zones/mapStore'

vi.mock('../MapEditorCanvas', () => ({
  MapEditorCanvas: () => <div data-testid="map-canvas" />,
}))

describe('MapEditor', () => {
  it('renders tool buttons and map name input', () => {
    render(<MapEditor onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByPlaceholderText('Map name')).toBeTruthy()
    expect(screen.getByText('Wall')).toBeTruthy()
    expect(screen.getByText('Eraser')).toBeTruthy()
    expect(screen.getByTestId('map-canvas')).toBeTruthy()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    render(<MapEditor onSave={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onSave when Save Map is clicked', () => {
    const onSave = vi.fn()
    render(<MapEditor onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByText('Save Map'))
    expect(onSave).toHaveBeenCalled()
  })

  it('pre-fills name when initial map provided', () => {
    const initial: SavedMap = {
      id: 'x1', name: 'Old Map', createdAt: 0,
      zone: {
        id: 'z1', name: 'Old Map', description: '', arenaSize: 20, floorColor: 0x444444,
        lighting: DAYLIGHT, structures: [], ctSpawns: [[0,-10]], tSpawns: [[0,10]],
        bombsites: [{ id: 'A', center: [10,0] }, { id: 'B', center: [-10,0] }],
      },
    }
    render(<MapEditor initial={initial} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect((screen.getByPlaceholderText('Map name') as HTMLInputElement).value).toBe('Old Map')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose MapEditor
```

Expected: FAIL — new tests fail until MapEditor is updated (old implementation has no data-testid canvas).

- [ ] **Step 3: Replace MapEditor.tsx**

Replace the entire contents of `src/ui/MapEditor.tsx`:

```tsx
import React, { useRef, useState, useCallback } from 'react'
import type { ZoneDef, ZoneStructure, StructureMaterial } from '../zones/ZoneDef'
import { DAYLIGHT } from '../zones/ZoneDef'
import { saveMap, newMapId } from '../zones/mapStore'
import type { SavedMap } from '../zones/mapStore'
import { MapEditorCanvas } from './MapEditorCanvas'
import type { Tool, TopSnapRef } from './MapEditorCanvas'
import { BlockPropertiesPanel } from './BlockPropertiesPanel'

const TOOLS: { value: Tool; label: string }[] = [
  { value: 'wall', label: 'Wall' }, { value: 'crate', label: 'Crate' },
  { value: 'concrete', label: 'Concrete' }, { value: 'metal', label: 'Metal' },
  { value: 'wood', label: 'Wood' }, { value: 'tspawn', label: 'T Spawn' },
  { value: 'ctspawn', label: 'CT Spawn' }, { value: 'bombA', label: 'Site A' },
  { value: 'bombB', label: 'Site B' }, { value: 'eraser', label: 'Eraser' },
]
const ARENA_SIZES = [20, 30, 40, 50]

function makeDefaultZone(arenaSize: number): ZoneDef {
  const s = arenaSize
  return {
    id: newMapId(), name: 'My Map', description: 'Custom map',
    arenaSize, floorColor: 0x444444, skyColor: 0x87ceeb,
    lighting: DAYLIGHT, structures: [],
    ctSpawns: [[0, -(s - 10)], [3, -(s - 10)], [-3, -(s - 10)]],
    tSpawns: [[0, s - 10], [3, s - 10], [-3, s - 10]],
    bombsites: [
      { id: 'A', center: [Math.round(s * 0.5), 0] },
      { id: 'B', center: [-Math.round(s * 0.5), 0] },
    ],
  }
}

const btn = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
  background: active ? '#ff6600' : '#1d1d2a', color: active ? '#000' : '#fff',
  border: '1px solid #3a3a55',
})

export function MapEditor({ initial, onSave, onCancel }: {
  initial?: SavedMap
  onSave: (map: SavedMap) => void
  onCancel: () => void
}) {
  const [zone, setZone] = useState<ZoneDef>(() => initial?.zone ?? makeDefaultZone(30))
  const [mapName, setMapName] = useState(initial?.name ?? 'My Map')
  const [tool, setTool] = useState<Tool>('wall')
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const topSnapRef = useRef<TopSnapRef | null>(null)

  const handlePlaceStructure = useCallback((s: ZoneStructure) => {
    setZone((prev) => {
      const newStructures = [...prev.structures, s]
      setSelectedIdx(newStructures.length - 1)
      return { ...prev, structures: newStructures }
    })
  }, [])

  const handlePlaceSpawn = useCallback((type: 'T' | 'CT', x: number, z: number) => {
    setZone((prev) =>
      type === 'T'
        ? { ...prev, tSpawns: [...prev.tSpawns, [x, z]] }
        : { ...prev, ctSpawns: [...prev.ctSpawns, [x, z]] }
    )
  }, [])

  const handleMoveBombsite = useCallback((id: 'A' | 'B', x: number, z: number) => {
    setZone((prev) => ({
      ...prev,
      bombsites: prev.bombsites.map((b) =>
        b.id === id ? { ...b, center: [x, z] as [number, number] } : b
      ),
    }))
  }, [])

  const handleDeleteStructure = useCallback((idx: number) => {
    setSelectedIdx(null)
    setZone((prev) => ({ ...prev, structures: prev.structures.filter((_, i) => i !== idx) }))
  }, [])

  const handleDeleteSpawn = useCallback((type: 'T' | 'CT', idx: number) => {
    setZone((prev) =>
      type === 'T'
        ? { ...prev, tSpawns: prev.tSpawns.filter((_, i) => i !== idx) }
        : { ...prev, ctSpawns: prev.ctSpawns.filter((_, i) => i !== idx) }
    )
  }, [])

  const handleUpdateStructure = useCallback((s: ZoneStructure) => {
    setZone((prev) => ({
      ...prev,
      structures: prev.structures.map((existing, i) => (i === selectedIdx ? s : existing)),
    }))
  }, [selectedIdx])

  function handleSave() {
    const map: SavedMap = {
      id: initial?.id ?? newMapId(),
      name: mapName.trim() || 'Unnamed',
      createdAt: initial?.createdAt ?? Date.now(),
      zone: { ...zone, name: mapName.trim() || 'Unnamed', id: initial?.zone.id ?? zone.id },
    }
    saveMap(map)
    onSave(map)
  }

  function handleDownload() {
    const payload = JSON.stringify({ version: 1, name: mapName, zone: { ...zone, name: mapName } }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${mapName.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  const selectedStructure = selectedIdx !== null ? zone.structures[selectedIdx] : null

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0e0e1a', display: 'flex',
      fontFamily: 'monospace', color: '#fff', overflow: 'hidden', zIndex: 60 }}>

      {/* Left panel */}
      <div style={{ width: 180, minWidth: 180, background: '#12121e', borderRight: '1px solid #3a3a55',
        display: 'flex', flexDirection: 'column', gap: 8, padding: 12, overflowY: 'auto' }}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>MAP EDITOR</div>

        <input
          value={mapName} onChange={(e) => setMapName(e.target.value)}
          placeholder="Map name"
          style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 13,
            background: '#1d1d2a', color: '#fff', border: '1px solid #3a3a55',
            width: '100%', boxSizing: 'border-box' }}
        />

        <div style={{ opacity: 0.6, fontSize: 11, marginTop: 4 }}>ARENA SIZE</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ARENA_SIZES.map((s) => (
            <button key={s} style={btn(zone.arenaSize === s)}
              onClick={() => setZone((prev) => ({
                ...makeDefaultZone(s), structures: prev.structures,
                ctSpawns: prev.ctSpawns, tSpawns: prev.tSpawns,
                bombsites: prev.bombsites, name: prev.name,
              }))}>
              {s * 2}
            </button>
          ))}
        </div>

        <div style={{ opacity: 0.6, fontSize: 11, marginTop: 4 }}>TOOLS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TOOLS.map((t) => (
            <button key={t.value} style={btn(tool === t.value)} onClick={() => setTool(t.value)}>
              {t.label}
            </button>
          ))}
        </div>

        <button
          style={{ ...btn(false), marginTop: 4 }}
          onClick={() => topSnapRef.current?.snap()}
        >
          ⊤ Top View
        </button>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, opacity: 0.5 }}>
            {zone.structures.length} structs · {zone.tSpawns.length}T · {zone.ctSpawns.length}CT
          </div>
          <button style={btn(false)} onClick={() => {
            setSelectedIdx(null)
            setZone((prev) => ({ ...prev, structures: [], tSpawns: [], ctSpawns: [] }))
          }}>Clear</button>
          <button style={btn(false)} onClick={handleDownload}>Download</button>
          <button style={btn(false)} onClick={onCancel}>Cancel</button>
          <button style={btn(true)} onClick={handleSave}>Save Map</button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapEditorCanvas
          zone={zone} tool={tool} selectedIdx={selectedIdx}
          topSnapRef={topSnapRef}
          onPlaceStructure={handlePlaceStructure}
          onPlaceSpawn={handlePlaceSpawn}
          onMoveBombsite={handleMoveBombsite}
          onSelectStructure={setSelectedIdx}
          onDeleteStructure={handleDeleteStructure}
          onDeleteSpawn={handleDeleteSpawn}
        />
      </div>

      {/* Right panel — shown only when a block is selected */}
      {selectedStructure && (
        <BlockPropertiesPanel
          structure={selectedStructure}
          onUpdate={handleUpdateStructure}
          onDelete={() => handleDeleteStructure(selectedIdx!)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- --reporter=verbose
```

Expected: all tests PASS. Pay attention to any pre-existing failures (see memory: preexisting-e2e-failures.md).

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/MapEditor.tsx src/ui/__tests__/MapEditor.test.tsx
git commit -m "feat: replace 2D MapEditor with 3D R3F editor — drag placement, orbit camera, block properties panel"
```
