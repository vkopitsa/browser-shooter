import React from 'react'

export interface ServerFilter {
  mode: 'all' | 'coop' | 'pvp' | 'hybrid' | 'competitive'
  status: 'all' | 'lobby' | 'in-progress'
  playerCount: 'all' | '1-2' | '3-4' | '5+'
}

interface ServerFiltersProps {
  filter: ServerFilter
  onChange: (filter: ServerFilter) => void
}

const filterBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 11px',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
  fontWeight: 'bold',
  letterSpacing: 0.5,
  whiteSpace: 'nowrap',
  background: active ? '#ff6600' : 'rgba(255,255,255,0.05)',
  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
  border: active ? '1px solid #ff6600' : '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  transition: 'all 0.1s',
})

const groupLabel: React.CSSProperties = {
  fontSize: 9,
  color: '#5aff8a',
  letterSpacing: 2,
  marginBottom: 5,
  opacity: 0.7,
}

export function ServerFilters({ filter, onChange }: ServerFiltersProps) {
  const modes: { value: ServerFilter['mode']; label: string }[] = [
    { value: 'all', label: 'ALL' },
    { value: 'competitive', label: 'COMPETITIVE' },
    { value: 'coop', label: 'CO-OP' },
    { value: 'pvp', label: 'PVP' },
    { value: 'hybrid', label: 'HYBRID' },
  ]

  const statuses: { value: ServerFilter['status']; label: string }[] = [
    { value: 'all', label: 'ALL' },
    { value: 'lobby', label: 'LOBBY' },
    { value: 'in-progress', label: 'IN PROGRESS' },
  ]

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12, fontFamily: 'monospace' }}>
      <div>
        <div style={groupLabel}>MODE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {modes.map((m) => (
            <button
              key={m.value}
              data-active={filter.mode === m.value ? 'true' : 'false'}
              style={filterBtn(filter.mode === m.value)}
              onClick={() => onChange({ ...filter, mode: m.value })}
            >{m.label}</button>
          ))}
        </div>
      </div>
      <div>
        <div style={groupLabel}>STATUS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {statuses.map((s) => (
            <button
              key={s.value}
              style={filterBtn(filter.status === s.value)}
              onClick={() => onChange({ ...filter, status: s.value })}
            >{s.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
