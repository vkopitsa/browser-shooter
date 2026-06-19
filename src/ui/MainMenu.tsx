import React from 'react'

interface MainMenuProps {
  onSingleplayer: () => void
  onMultiplayer: () => void
  onSettings: () => void
  onAbout: () => void
  onHelp: () => void
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onSingleplayer, onMultiplayer, onSettings, onAbout, onHelp,
}) => {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a3e 100%)',
      color: 'white',
      fontFamily: 'monospace',
    }}>
      <h1 style={{
        fontSize: 64,
        fontWeight: 'bold',
        textShadow: '0 0 30px #ff6600, 0 0 60px #ff3300',
        marginBottom: 10,
        color: '#ff6600',
        textAlign: 'center',
      }}>
        BROWSER SHOOTER
      </h1>
      <p style={{ fontSize: 18, opacity: 0.6, marginBottom: 40 }}>
        3D FPS Arena Wave Survival
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
        <button onClick={onSingleplayer} style={{
          padding: '16px 40px', fontSize: 22, fontWeight: 'bold', background: '#ff6600',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>SINGLEPLAYER</button>
        <button onClick={onMultiplayer} style={{
          padding: '16px 40px', fontSize: 22, fontWeight: 'bold', background: '#3399ff',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>MULTIPLAYER</button>
        <button onClick={onSettings} style={{
          padding: '16px 40px', fontSize: 22, fontWeight: 'bold', background: '#444',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>SETTINGS</button>
        <button onClick={onAbout} style={{
          padding: '16px 40px', fontSize: 22, fontWeight: 'bold', background: '#333',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>ABOUT</button>
        <button onClick={onHelp} style={{
          padding: '16px 40px', fontSize: 22, fontWeight: 'bold', background: '#333',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>HELP</button>
      </div>
    </div>
  )
}
