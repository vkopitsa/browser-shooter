import React from 'react'
import type { Team } from '../types'
import type { MatchScores } from '../session/protocol'
import { BattlefieldBackground } from './BattlefieldBackground'

export const MatchOver: React.FC<{ winningTeam: Team | null; scores: MatchScores; onBackToLobby: () => void; onRestart?: () => void }>
  = ({ winningTeam, scores, onBackToLobby, onRestart }) => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
    isolation: 'isolate',
    color: '#fff', fontFamily: 'monospace', zIndex: 60 }}>
    <BattlefieldBackground />
    <h1 style={{ margin: 0, color: winningTeam === 'ct' ? '#3a6ea5' : '#a5703a' }}>
      {winningTeam ? `${winningTeam === 'ct' ? 'COUNTER-TERRORISTS' : 'TERRORISTS'} WIN` : 'MATCH OVER'}
    </h1>
    <div style={{ display: 'flex', gap: 40 }}>
      <div><div style={{ color: '#3a6ea5' }}>CT</div><div style={{ fontSize: 32 }}>{scores.teams.ct}</div></div>
      <div><div style={{ color: '#a5703a' }}>T</div><div style={{ fontSize: 32 }}>{scores.teams.t}</div></div>
    </div>
    <div style={{ display: 'flex', gap: 16 }}>
      {onRestart && (
        <button onClick={onRestart} style={{ padding: '12px 24px', background: '#ff6600', color: '#000',
          border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: 16 }}>Play Again</button>
      )}
      <button onClick={onBackToLobby} style={{ padding: '12px 24px', background: '#ff6600', color: '#000',
        border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: 16 }}>Back to Lobby</button>
    </div>
  </div>
)
