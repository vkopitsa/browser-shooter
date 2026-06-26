import { describe, it, expect } from 'vitest'
import { snapToGrid, dragRect } from '../MapEditorCanvas'

const DEFAULT_HEIGHT = { wall: 3, crate: 1.5, concrete: 2, metal: 2, wood: 1.5 } as const

describe('snapToGrid', () => {
  it('rounds to nearest 0.5', () => {
    expect(snapToGrid(1.3)).toBe(1.5)
    expect(snapToGrid(1.2)).toBe(1.0)
    expect(snapToGrid(0)).toBe(0)
    expect(snapToGrid(-1.8)).toBe(-2.0)
  })
})

describe('dragRect', () => {
  it('computes center and size from two corner points', () => {
    const r = dragRect({ x: 0, z: 0 }, { x: 4, z: 6 }, 'wall', DEFAULT_HEIGHT)
    expect(r.center).toEqual([2, 1.5, 3])   // cx=2, y=h/2=1.5, cz=3
    expect(r.size).toEqual([4, 3, 6])        // w=4, h=3 (wall), d=6
  })

  it('handles reversed drag (end before start)', () => {
    const r = dragRect({ x: 4, z: 6 }, { x: 0, z: 0 }, 'crate', DEFAULT_HEIGHT)
    expect(r.center).toEqual([2, 0.75, 3])   // y=1.5/2=0.75
    expect(r.size).toEqual([4, 1.5, 6])
  })

  it('enforces minimum size of 1 when start == end', () => {
    const r = dragRect({ x: 2, z: 2 }, { x: 2, z: 2 }, 'wall', DEFAULT_HEIGHT)
    expect(r.size[0]).toBe(1)  // min width
    expect(r.size[2]).toBe(1)  // min depth
  })

  it('uses correct height per material', () => {
    expect(dragRect({ x: 0, z: 0 }, { x: 2, z: 2 }, 'concrete', DEFAULT_HEIGHT).size[1]).toBe(2)
    expect(dragRect({ x: 0, z: 0 }, { x: 2, z: 2 }, 'wood', DEFAULT_HEIGHT).size[1]).toBe(1.5)
  })
})
