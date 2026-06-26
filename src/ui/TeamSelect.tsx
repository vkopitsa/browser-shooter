import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { Team } from '../types'
import type { ZoneDef } from '../zones/ZoneDef'
import type { SavedMap } from '../zones/mapStore'
import { loadMaps } from '../zones/mapStore'
import { ZONES, DEFAULT_ZONE_ID } from '../zones/registry'
import { BattlefieldBackground } from './BattlefieldBackground'

interface TeamSelectProps {
  onSelect: (team: Team, zoneId: string, customZone?: ZoneDef) => void
  onBack?: () => void
  selected?: Team
  counts?: { ct: number; t: number }
  onCreateMap?: () => void
  onEditMap?: (map: SavedMap) => void
}

export function TeamSelect({ onSelect, onBack, selected, counts, onCreateMap, onEditMap }: TeamSelectProps) {
  const [zoneId, setZoneId] = useState<string>(DEFAULT_ZONE_ID)
  const [customZone, setCustomZone] = useState<ZoneDef | undefined>(undefined)
  const [myMaps] = useState<SavedMap[]>(() => loadMaps())

  function selectCustomMap(m: SavedMap) {
    setZoneId('custom')
    setCustomZone(m.zone)
  }

  const card = (team: Team, label: string, bg: string, border: string) => (
    <button
      onClick={() => onSelect(team, zoneId, customZone)}
      style={{
        padding: '20px 32px', background: bg, color: '#fff',
        border: selected === team ? '3px solid #fff' : `1px solid ${border}`,
        cursor: 'pointer', fontSize: 16, minWidth: 'min(200px, calc(50vw - 28px))',
      }}
    >
      <div>{label}</div>
      {counts && <div style={{ opacity: 0.7, fontSize: 13, marginTop: 6 }}>{team === 'ct' ? counts.ct : counts.t} players</div>}
    </button>
  )

  const smallBtn: CSSProperties = {
    padding: '6px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
    background: '#1d1d2a', color: '#fff', border: '1px solid #3a3a55',
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      isolation: 'isolate', fontFamily: 'monospace', color: '#fff', zIndex: 50,
      padding: 'calc(16px + var(--safe-top)) 16px calc(16px + var(--safe-bottom))',
      boxSizing: 'border-box', overflowY: 'auto',
    }}>
      <BattlefieldBackground />
      <h2 style={{ margin: 0 }}>CHOOSE YOUR ZONE</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 560 }}>
        {ZONES.map((m) => {
          const active = zoneId === m.id
          return (
            <button key={m.id} onClick={() => { setZoneId(m.id); setCustomZone(undefined) }} style={{
              cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left',
              padding: '8px 12px', width: 170, boxSizing: 'border-box',
              background: active ? '#ff6600' : '#1d1d2a', color: active ? '#000' : '#fff',
              border: active ? '1px solid #ff6600' : '1px solid #3a3a55',
            }}>
              <div style={{ fontSize: 14, fontWeight: 'bold' }}>{m.name}</div>
              <div style={{ fontSize: 11, opacity: active ? 0.75 : 0.6, marginTop: 3, lineHeight: 1.3 }}>{m.description}</div>
            </button>
          )
        })}
      </div>

      {onCreateMap && (
        <>
          <h2 style={{ margin: '8px 0 0' }}>CUSTOM MAPS</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 560 }}>
            {myMaps.length === 0
              ? <div style={{ opacity: 0.4, fontSize: 12 }}>No custom maps yet — create one.</div>
              : myMaps.map((m) => {
                const active = zoneId === 'custom' && customZone?.id === m.zone.id
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => selectCustomMap(m)} style={{
                      flex: 1, textAlign: 'left', padding: '8px 12px',
                      background: active ? '#ff6600' : '#1d1d2a', color: active ? '#000' : '#fff',
                      border: active ? '1px solid #ff6600' : '1px solid #3a3a55',
                      cursor: 'pointer', fontFamily: 'monospace', fontSize: 13,
                    }}>{m.name}</button>
                    {onEditMap && <button style={smallBtn} onClick={() => onEditMap(m)}>Edit</button>}
                  </div>
                )
              })
            }
            <button style={smallBtn} onClick={onCreateMap}>+ Create</button>
          </div>
        </>
      )}

      <h2 style={{ margin: '8px 0 0' }}>CHOOSE YOUR SIDE</h2>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {card('ct', 'Counter-Terrorist', '#1d3a5f', '#3a6ea5')}
        {card('t', 'Terrorist', '#5f3a1d', '#a5703a')}
      </div>

      {onBack && (
        <button onClick={onBack} style={{
          marginTop: 24, padding: '10px 24px', background: '#1d1d2a', color: '#fff',
          border: '1px solid #3a3a55', cursor: 'pointer', fontFamily: 'monospace', fontSize: 14,
        }}>Back</button>
      )}
    </div>
  )
}
