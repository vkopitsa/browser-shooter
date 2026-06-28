# Planetary Mobile CS Mode Button + Map Picker Dot — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix two bugs — (1) overlay buttons unresponsive on mobile in PlanetaryMode, (2) map picker shows no selected-location dot.

**Architecture:** Minimal CSS/state changes to two existing components. No new files, no new dependencies.

**Tech Stack:** React, TypeScript, MapLibre GL

---

## Task 1: Fix overlay buttons on mobile (PlanetaryMode.tsx)

**Objective:** Make `[M] Map`, `[V] View CS Mode`, and `Exit` buttons tappable on touch devices by raising zIndex above TouchControls overlay and stopping pointer event propagation.

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx` (lines 514-545)

**Step 1: Add zIndex and pointer event handler to all three buttons**

Replace the three button blocks with the following updated styles:

```tsx
      <button
        onClick={() => setShowPicker(true)}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 16, left: 16, padding: '6px 12px',
          background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid #555',
          borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
          zIndex: 100,
        }}
      >
        [M] Map
      </button>

      <button
        onClick={onExit}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 52, left: 16, padding: '6px 12px',
          background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid #555',
          borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
          zIndex: 100,
        }}
      >
        [V] View CS Mode
      </button>

      <button
        onClick={onExit}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 16, right: 16, padding: '6px 12px',
          background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid #555',
          borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
          zIndex: 100,
        }}
      >
        Exit
      </button>
```

**Step 2: Verify the change compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no errors

**Step 3: Commit**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "fix(planetary): make overlay buttons tappable on mobile

Raise zIndex above TouchControls look pad (25) and stop pointer
event propagation so touches reach the buttons instead of being
eaten by the full-screen look pad."
```

---

## Task 2: Add selected-location dot to MapPicker

**Objective:** Show a green dot at the location the user clicked on the map picker, so they have visual confirmation of their drop point.

**Files:**
- Modify: `src/planetary/MapPicker.tsx`

**Step 1: Add selectedLocation state and update click handler**

Inside the `MapPicker` component, add state and modify the click handler:

```tsx
export function MapPicker({ playerPositions, onTeleport, onClose }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null)
```

And in the map click handler:

```tsx
    map.on('click', e => {
      setSelectedLocation([e.lngLat.lng, e.lngLat.lat])
      onTeleport(e.lngLat.lng, e.lngLat.lat)
    })
```

**Step 2: Render the selected-location dot**

Add a useEffect that renders a green dot when `selectedLocation` is set:

```tsx
  // Green dot showing where the user will drop in
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedLocation) return
    const el = document.createElement('div')
    el.style.cssText = 'width:14px;height:14px;border-radius:50%;background:#00ff88;border:3px solid white;box-shadow:0 0 8px rgba(0,255,136,0.6)'
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(selectedLocation)
      .addTo(map)
    return () => { marker.remove() }
  }, [selectedLocation])
```

**Step 3: Clear selectedLocation on close**

Add to the close button handler:

```tsx
      <button
        aria-label="Close map picker"
        onClick={() => { setSelectedLocation(null); onClose() }}
        ...
      >
```

**Step 4: Verify tests still pass**

Run: `npx vitest run src/planetary/__tests__/MapPicker.test.tsx --reporter=verbose`
Expected: 2 passed

**Step 5: Commit**

```bash
git add src/planetary/MapPicker.tsx
git commit -m "feat(map-picker): show green dot at selected drop location

Adds visual confirmation of the drop point when user clicks the map.
Clears the dot when the picker closes."
```

---

## Verification Summary

After both tasks:

1. `npx vitest run src/planetary/__tests__/MapPicker.test.tsx` — 2 passed
2. `npx tsc --noEmit` — no errors
3. Manual: Open planetary mode on mobile → tap `[V] View CS Mode` → should respond
4. Manual: Open map picker → no dot initially → click map → green dot appears at click location
