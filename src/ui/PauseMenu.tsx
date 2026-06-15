import React from 'react'

interface PauseMenuProps {
  onResume: () => void
  onMainMenu: () => void
}

export const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onMainMenu }) => {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.75)',
      color: 'white',
      fontFamily: 'monospace',
      zIndex: 30,
    }}>
      <h1 style={{
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#ff6600',
        textShadow: '0 0 20px #ff6600',
      }}>
        PAUSED
      </h1>
      <p style={{ fontSize: 14, opacity: 0.5, marginBottom: 40 }}>
        Press ESC to resume
      </p>

      <button
        onClick={onResume}
        style={{
          padding: '14px 48px',
          fontSize: 18,
          fontWeight: 'bold',
          background: '#ff6600',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          marginBottom: 16,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#ff8800'
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#ff6600'
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        RESUME
      </button>

      <button
        onClick={onMainMenu}
        style={{
          padding: '12px 36px',
          fontSize: 16,
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          border: '1px solid #555',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
        }}
      >
        MAIN MENU
      </button>

      <div style={{
        marginTop: 50,
        padding: 20,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        fontSize: 12,
        opacity: 0.4,
      }}>
        <div style={{ marginBottom: 4 }}>WASD - Move</div>
        <div style={{ marginBottom: 4 }}>Mouse - Look</div>
        <div style={{ marginBottom: 4 }}>Click - Shoot</div>
        <div style={{ marginBottom: 4 }}>R - Reload</div>
        <div style={{ marginBottom: 4 }}>1-3 - Switch Weapon</div>
        <div>ESC - Pause</div>
      </div>
    </div>
  )
}
