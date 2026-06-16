import React, { useState } from 'react'
import { ServerList, type ServerRow } from './ServerList'

interface MultiplayerMenuProps {
  roomCode: string | null      // set once hosting; null while choosing/joining
  players: string[]            // lobby roster (names)
  isHost: boolean
  servers: ServerRow[]         // discovered open games
  onHost: () => void           // start hosting (creates the room)
  onJoin: (code: string) => void
  onStart: () => void          // host begins the match
  onBack: () => void
  onRefresh: () => void        // re-query the directory
}

const panel: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 16,
  background: 'linear-gradient(180deg,#0a0a1a,#1a1a3e)', color: 'white', fontFamily: 'monospace',
}
const btn: React.CSSProperties = {
  padding: '12px 32px', fontSize: 18, fontWeight: 'bold', background: '#3399ff',
  color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
}

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = (p) => {
  const [code, setCode] = useState('')
  const inLobby = p.roomCode !== null || p.players.length > 0

  if (inLobby) {
    return (
      <div style={panel}>
        <h2>Lobby</h2>
        {p.roomCode && (
          <div>Room code: <strong style={{ fontSize: 24 }}>{p.roomCode}</strong>{' '}
            <button style={btn} onClick={() => navigator.clipboard?.writeText(p.roomCode!)}>Copy</button>
          </div>
        )}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {p.players.map((name) => <li key={name}>{name}</li>)}
        </ul>
        {p.isHost
          ? <button style={btn} onClick={p.onStart}>Start</button>
          : <p>Waiting for host to start…</p>}
        <button style={{ ...btn, background: '#555' }} onClick={p.onBack}>Back</button>
      </div>
    )
  }

  return (
    <div style={panel}>
      <h2>Multiplayer (Co-op)</h2>
      <button style={btn} onClick={p.onHost}>Host Game</button>
      <ServerList servers={p.servers} onJoin={p.onJoin} onRefresh={p.onRefresh} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input placeholder="Room code" value={code} onChange={(e) => setCode(e.target.value)}
          style={{ padding: 10, fontSize: 16 }} />
        <button style={btn} onClick={() => onJoinClick()}>Join</button>
      </div>
      <button style={{ ...btn, background: '#555' }} onClick={p.onBack}>Back</button>
    </div>
  )

  function onJoinClick() { if (code.trim()) p.onJoin(code.trim()) }
}
