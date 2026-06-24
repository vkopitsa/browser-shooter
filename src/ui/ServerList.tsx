import React, { useState, useMemo } from 'react'
import { ServerFilters, type ServerFilter } from './ServerFilters'
import type { DirectoryEntry } from '../net/directoryProtocol'

export interface ServerRow extends DirectoryEntry {
  ping: number | null
}

interface ServerListProps {
  servers: ServerRow[]
  onJoin: (server: ServerRow) => void
  onRefresh: () => void
  filterMode?: string
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
  background: 'rgba(255,255,255,0.04)',
  borderLeft: '2px solid rgba(0,200,80,0.25)',
  borderRadius: 4,
  width: '100%',
}

const cell: React.CSSProperties = { fontSize: 13, fontFamily: 'monospace' }

const joinBtn: React.CSSProperties = {
  marginLeft: 'auto', padding: '5px 14px',
  background: '#3399ff', color: 'white',
  border: 'none', borderRadius: 5, cursor: 'pointer',
  fontWeight: 'bold', fontFamily: 'monospace', fontSize: 12, letterSpacing: 0.5,
}

const refreshBtn: React.CSSProperties = {
  padding: '5px 14px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, cursor: 'pointer',
  fontFamily: 'monospace', fontSize: 11, letterSpacing: 1,
}

export const ServerList: React.FC<ServerListProps> = ({ servers, onJoin, onRefresh, filterMode }) => {
  const [filter, setFilter] = useState<ServerFilter>({
    mode: (filterMode as ServerFilter['mode']) ?? 'all',
    status: 'all',
    playerCount: 'all',
  })

  const filteredServers = useMemo(() => {
    return servers
      .filter((s) => {
        if (filter.mode !== 'all' && s.mode !== filter.mode) return false
        if (filter.status !== 'all' && s.status !== filter.status) return false
        if (filter.playerCount === '1-2' && s.players > 2) return false
        if (filter.playerCount === '3-4' && (s.players < 3 || s.players > 4)) return false
        if (filter.playerCount === '5+' && s.players < 5) return false
        return true
      })
      .sort((a, b) => {
        if (a.ping === null) return 1
        if (b.ping === null) return -1
        return a.ping - b.ping
      })
  }, [servers, filter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <ServerFilters filter={filter} onChange={setFilter} />
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 1, fontFamily: 'monospace' }}>
          GAMES ({filteredServers.length})
        </span>
        <button style={{ ...refreshBtn, marginLeft: 'auto' }} onClick={onRefresh}>↻ REFRESH</button>
      </div>
      {filteredServers.length === 0
        ? (
          <div style={{
            opacity: 0.4, padding: '16px 0', textAlign: 'center',
            fontSize: 13, fontFamily: 'monospace', borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>No games found</div>
        )
        : filteredServers.map((s) => (
          <div key={s.roomCode} style={rowStyle}>
            <span style={{ ...cell, minWidth: 110, color: '#fff' }}>{s.hostName}</span>
            <span style={{ ...cell, opacity: 0.7 }}>{s.mode ?? '?'}</span>
            <span style={{ ...cell, opacity: 0.6 }}>{s.players}/{s.maxPlayers}</span>
            <span style={{ ...cell, opacity: 0.55 }}>{s.joinPolicy === 'free' ? 'Free' : 'Lobby'}</span>
            {s.protected && <span style={cell} title="Password required">🔒</span>}
            <span style={{ ...cell, opacity: 0.55 }}>{s.status === 'lobby' ? 'Lobby' : 'Playing'}</span>
            <span style={{ ...cell, opacity: 0.5, minWidth: 50 }}>{s.ping === null ? '—' : `${s.ping}ms`}</span>
            <button style={joinBtn} onClick={() => onJoin(s)}>JOIN</button>
          </div>
        ))}
    </div>
  )
}
