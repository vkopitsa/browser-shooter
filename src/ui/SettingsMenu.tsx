import React from 'react'
import type { Settings, MobileControlsMode } from '../settings/Settings'
import { isTouchDevice } from '../settings/Settings'
import { CrosshairEditor } from './CrosshairEditor'
import { BattlefieldBackground } from './BattlefieldBackground'

interface SettingsMenuProps {
  settings: Settings
  onChange: (settings: Settings) => void
  onBack: () => void
  onKeybinds: () => void
}

const scroll: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: 12,
  padding: 'calc(28px + var(--safe-top)) 16px calc(28px + var(--safe-bottom))',
  boxSizing: 'border-box', overflowY: 'auto',
  color: 'white', fontFamily: 'monospace',
}

const card: React.CSSProperties = {
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(0,200,80,0.13)',
  borderTop: '2px solid rgba(0,200,80,0.3)',
  borderRadius: 8,
  padding: '18px 20px',
  display: 'flex', flexDirection: 'column', gap: 20,
  width: 'min(400px, calc(100vw - 32px))', boxSizing: 'border-box',
}

const cardLabel: React.CSSProperties = {
  fontSize: 10, color: '#5aff8a', letterSpacing: 2, opacity: 0.75,
  marginBottom: -8,
}

const fieldLabel: React.CSSProperties = {
  fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 1,
  marginBottom: 8, display: 'block',
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 15, width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)', color: 'white',
  border: '1px solid rgba(0,200,80,0.2)', borderRadius: 6,
  fontFamily: 'monospace', outline: 'none',
}

const MOBILE_OPTIONS: { value: MobileControlsMode; label: string }[] = [
  { value: 'auto', label: 'AUTO' },
  { value: 'on', label: 'ON' },
  { value: 'off', label: 'OFF' },
]

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ settings, onChange, onBack, onKeybinds }) => {
  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      <BattlefieldBackground />
      <div style={scroll}>
        <h1 style={{
          fontSize: 'clamp(26px, 8vw, 40px)', fontWeight: 'bold',
          color: '#ff6600', textShadow: '0 0 20px #ff6600, 0 0 40px #ff3300',
          letterSpacing: 4, margin: '0 0 4px',
        }}>SETTINGS</h1>

        {/* Player card */}
        <div style={card}>
          <div style={cardLabel}>PLAYER</div>

          <div>
            <span style={fieldLabel}>NAME</span>
            <input
              value={settings.playerName}
              maxLength={16}
              onChange={(e) => onChange({ ...settings, playerName: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <span style={fieldLabel}>
              TOUCH CONTROLS
              {settings.mobileControls === 'auto' && (
                <span style={{ opacity: 0.45, fontSize: 10, marginLeft: 8 }}>
                  detected: {isTouchDevice() ? 'touch' : 'no touch'}
                </span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {MOBILE_OPTIONS.map((opt) => {
                const active = settings.mobileControls === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => onChange({ ...settings, mobileControls: opt.value })}
                    style={{
                      flex: 1, padding: '10px 0',
                      fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13, letterSpacing: 1,
                      background: active ? '#ff6600' : 'rgba(255,255,255,0.05)',
                      color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                      border: active ? '1px solid #ff6600' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6, cursor: 'pointer',
                    }}
                  >{opt.label}</button>
                )
              })}
            </div>
          </div>

          <div>
            <span style={fieldLabel}>LOOK SENSITIVITY — {settings.lookSensitivity.toFixed(1)}×</span>
            <input
              type="range" min={0.5} max={2.5} step={0.1} value={settings.lookSensitivity}
              onChange={(e) => onChange({ ...settings, lookSensitivity: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#ff6600' }}
            />
          </div>
        </div>

        {/* Crosshair card */}
        <div style={card}>
          <div style={cardLabel}>CROSSHAIR</div>
          <CrosshairEditor
            value={settings.crosshair}
            onChange={(crosshair) => onChange({ ...settings, crosshair })}
          />
        </div>

        <button
          onClick={onKeybinds}
          style={{
            padding: '12px 0', width: 'min(400px, calc(100vw - 32px))',
            fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14, letterSpacing: 2,
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, cursor: 'pointer',
          }}
        >KEYBINDS →</button>
        <button
          onClick={onBack}
          style={{
            padding: '12px 0', width: 'min(400px, calc(100vw - 32px))',
            fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14, letterSpacing: 2,
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, cursor: 'pointer',
          }}
        >BACK</button>
      </div>
    </div>
  )
}
