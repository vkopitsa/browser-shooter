import React, { useState } from 'react'
import { ServerList, type ServerRow } from './ServerList'
import { PreJoinPrompt } from './PreJoinPrompt'
import { MatchmakingButton } from './MatchmakingButton'
import type { Team } from '../types'
import { BattlefieldBackground } from './BattlefieldBackground'

interface MultiplayerMenuProps {
  roomCode: string | null
  players: string[]
  isHost: boolean
  servers: ServerRow[]
  onHost: () => void
  onJoin: (code: string, password?: string) => void
  onStart: () => void
  onBack: () => void
  onRefresh: () => void
  onQuickMatch?: () => void
  myTeam?: import('../types').Team
  onSelectTeam?: (team: import('../types').Team) => void
  roster?: { ct: string[]; t: string[] }
  onJoinFree?: (code: string, team: Team, password: string) => void
  joinError?: string | null
  onCancelJoin?: () => void
}

const scroll: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: 12, overflow: 'auto',
  color: 'white', fontFamily: 'monospace',
  padding: 'calc(24px + var(--safe-top)) 16px calc(24px + var(--safe-bottom))',
  boxSizing: 'border-box',
}

const card: React.CSSProperties = {
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(0,200,80,0.13)',
  borderRadius: 8,
  padding: '16px 20px',
  width: '100%',
  maxWidth: 560,
  boxSizing: 'border-box',
}

const cardLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#5aff8a',
  letterSpacing: 2,
  marginBottom: 10,
  opacity: 0.75,
}

const btn: React.CSSProperties = {
  padding: '12px 28px', fontSize: 15, fontWeight: 'bold', background: '#3399ff',
  color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer',
  fontFamily: 'monospace', letterSpacing: 1,
}

const heading: React.CSSProperties = {
  fontSize: 'clamp(26px, 8vw, 44px)', fontWeight: 'bold',
  color: '#ff6600', textShadow: '0 0 20px #ff6600, 0 0 40px #ff3300',
  letterSpacing: 4, margin: '0 0 4px',
}

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = (p) => {
  const [code, setCode] = useState('')
  const [codePassword, setCodePassword] = useState('')
  const [queuing, setQueuing] = useState(false)
  const [joining, setJoining] = useState<ServerRow | null>(null)
  const inLobby = p.roomCode !== null || p.players.length > 0

  if (inLobby) {
    return (
      <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
        <BattlefieldBackground />
        <div style={{ ...scroll, justifyContent: 'center' }}>
          <h1 style={heading}>LOBBY</h1>

          <div style={card}>
            {p.roomCode && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={cardLabel}>ROOM CODE</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <strong style={{ fontSize: 28, letterSpacing: 6, color: '#5aff8a' }}>{p.roomCode}</strong>
                  <button
                    style={{ ...btn, background: '#2a2a3f', border: '1px solid #3a3a55', fontSize: 12, padding: '8px 16px' }}
                    onClick={() => navigator.clipboard?.writeText(p.roomCode!)}
                  >COPY</button>
                </div>
              </div>
            )}
            <div style={cardLabel}>PLAYERS</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {p.players.map((name) => (
                <li key={name} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 4, fontSize: 14 }}>
                  {name}
                </li>
              ))}
            </ul>
          </div>

          {p.onSelectTeam && (
            <div style={card}>
              <div style={cardLabel}>CHOOSE TEAM</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => p.onSelectTeam!('ct')}
                  style={{ flex: 1, padding: '10px 0', background: p.myTeam === 'ct' ? '#3a6ea5' : '#1d3a5f', color: '#fff', border: '1px solid #3a6ea5', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold', borderRadius: 6 }}
                >CT{p.roster ? ` (${p.roster.ct.length})` : ''}</button>
                <button
                  onClick={() => p.onSelectTeam!('t')}
                  style={{ flex: 1, padding: '10px 0', background: p.myTeam === 't' ? '#a5703a' : '#5f3a1d', color: '#fff', border: '1px solid #a5703a', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold', borderRadius: 6 }}
                >T{p.roster ? ` (${p.roster.t.length})` : ''}</button>
              </div>
              {p.roster && (
                <div style={{ display: 'flex', gap: 40, marginTop: 12 }}>
                  <div>
                    <div style={{ color: '#3a6ea5', fontSize: 11, marginBottom: 4, letterSpacing: 1 }}>COUNTER-TERRORISTS</div>
                    {p.roster.ct.map((n, i) => <div key={i} style={{ fontSize: 13 }}>{n}</div>)}
                  </div>
                  <div>
                    <div style={{ color: '#a5703a', fontSize: 11, marginBottom: 4, letterSpacing: 1 }}>TERRORISTS</div>
                    {p.roster.t.map((n, i) => <div key={i} style={{ fontSize: 13 }}>{n}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {p.isHost
            ? <button style={{ ...btn, width: '100%', maxWidth: 320, background: '#ff6600', fontSize: 16 }} onClick={p.onStart}>START MATCH</button>
            : <p style={{ opacity: 0.5, fontSize: 13 }}>Waiting for host to start…</p>}
          <button style={{ ...btn, background: '#333', width: '100%', maxWidth: 320 }} onClick={p.onBack}>BACK</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      <BattlefieldBackground />
      <div style={scroll}>
        <h1 style={heading}>MULTIPLAYER</h1>

        {/* Quick Match */}
        <div style={card}>
          <div style={cardLabel}>QUICK MATCH</div>
          <MatchmakingButton
            queuing={queuing}
            onFind={() => { setQueuing(true); p.onQuickMatch?.() }}
            onCancel={() => setQueuing(false)}
          />
          <p style={{ fontSize: 11, opacity: 0.5, margin: '6px 0 0', textAlign: 'center' }}>
            Auto-find a competitive match
          </p>
        </div>

        {/* Browse Servers */}
        <div style={card}>
          <div style={cardLabel}>BROWSE GAMES</div>
          <ServerList
            servers={p.servers}
            onJoin={(server) => {
              if (server.joinPolicy === 'free' || server.protected) setJoining(server)
              else p.onJoin(server.roomCode)
            }}
            onRefresh={p.onRefresh}
          />
        </div>

        {/* Host + Join row */}
        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 560, flexWrap: 'wrap' }}>
          <div style={{ ...card, flex: '1 1 200px', maxWidth: '100%' }}>
            <div style={cardLabel}>HOST</div>
            <button style={{ ...btn, width: '100%', background: '#ff6600' }} onClick={p.onHost}>CREATE ROOM</button>
            <p style={{ fontSize: 11, opacity: 0.5, margin: '6px 0 0', textAlign: 'center' }}>Host your own game</p>
          </div>
          <div style={{ ...card, flex: '1 1 200px', maxWidth: '100%' }}>
            <div style={cardLabel}>JOIN BY CODE</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Room code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onJoinClick()}
                style={{
                  flex: 1, padding: '10px 12px', fontSize: 14,
                  background: '#0a0a14', color: 'white',
                  border: '1px solid #2a2a4f', borderRadius: 6,
                  fontFamily: 'monospace', outline: 'none',
                }}
              />
              <button style={btn} aria-label="join by code" onClick={() => onJoinClick()}>JOIN</button>
            </div>
            {!joining && (
              <input
                placeholder="Password (optional)"
                value={codePassword}
                onChange={(e) => setCodePassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onJoinClick()}
                style={{
                  marginTop: 8, width: '100%', padding: '10px 12px', fontSize: 14,
                  background: '#0a0a14', color: 'white',
                  border: '1px solid #2a2a4f', borderRadius: 6,
                  fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
                }}
              />
            )}
          </div>
        </div>

        <button style={{ ...btn, background: '#2a2a3f', border: '1px solid #3a3a55', width: '100%', maxWidth: 560 }} onClick={p.onBack}>BACK</button>
      </div>

      {joining && (
        <PreJoinPrompt
          protected={joining.protected}
          showTeam={joining.joinPolicy === 'free'}
          error={p.joinError}
          onSubmit={(team, password) => {
            if (joining.joinPolicy === 'free') p.onJoinFree?.(joining.roomCode, team, password)
            else p.onJoin(joining.roomCode, password)
          }}
          onCancel={() => { setJoining(null); p.onCancelJoin?.() }}
        />
      )}
    </div>
  )

  function onJoinClick() {
    if (!code.trim()) return
    const pw = codePassword.trim()
    if (pw) p.onJoin(code.trim(), pw)
    else p.onJoin(code.trim())
  }
}
