import React from 'react'
import type { DamageIndicatorState } from '../effects/DamageIndicator'

interface DamageOverlayProps {
  indicator: DamageIndicatorState | null
}

export const DamageOverlay: React.FC<DamageOverlayProps> = ({ indicator }) => {
  if (!indicator || !indicator.active) return null

  return (
    <>
      {/* Red vignette / full-screen flash */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, rgba(255,0,0,${indicator.flashOpacity * 0.3}) 0%, rgba(255,0,0,${indicator.flashOpacity}) 100%)`,
        zIndex: 10,
      }} />

      {/* Directional damage indicator */}
      {indicator.directionalAngle !== null && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${indicator.directionalAngle}rad)`,
          pointerEvents: 'none',
          zIndex: 11,
        }}>
          <div style={{
            width: 0,
            height: 0,
            borderLeft: '12px solid transparent',
            borderRight: '12px solid transparent',
            borderBottom: `24px solid rgba(255, 0, 0, ${indicator.flashOpacity})`,
            transform: 'translateY(-40px)',
            filter: 'drop-shadow(0 0 6px rgba(255,0,0,0.8))',
          }} />
        </div>
      )}
    </>
  )
}
