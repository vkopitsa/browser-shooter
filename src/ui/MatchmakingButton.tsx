import React from 'react'

interface MatchmakingButtonProps {
  onFind?: () => void
  onCancel?: () => void
  queuing: boolean
}

const base: React.CSSProperties = {
  padding: '14px 32px', fontSize: 16, fontWeight: 'bold',
  color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer',
  width: '100%', fontFamily: 'monospace', letterSpacing: 2,
}

export function MatchmakingButton({ onFind, onCancel, queuing }: MatchmakingButtonProps) {
  if (queuing) {
    return (
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <button style={{ ...base, flex: 1, background: '#ff6600', opacity: 0.75 }} disabled>
          SEARCHING...
        </button>
        <button style={{ ...base, background: '#cc3300', flex: 0, padding: '14px 20px', letterSpacing: 0 }} onClick={onCancel}>
          CANCEL
        </button>
      </div>
    )
  }

  return (
    <button style={{ ...base, background: '#3399ff' }} onClick={onFind}>
      QUICK MATCH
    </button>
  )
}
