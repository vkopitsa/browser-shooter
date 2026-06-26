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
