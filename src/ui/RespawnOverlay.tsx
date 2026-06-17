import React from 'react'

export const RespawnOverlay: React.FC<{ seconds: number }> = ({ seconds }) => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)',
    color: '#fff', fontFamily: 'monospace', zIndex: 58, pointerEvents: 'none' }}>
    <div style={{ fontSize: 28, color: '#ff5544' }}>YOU DIED</div>
    <div style={{ fontSize: 18, marginTop: 8 }}>Respawning in {Math.ceil(seconds)}…</div>
  </div>
)
