import React, { useState, useEffect, useRef } from 'react'

interface WaveAnnounceProps {
  wave: number
  visible: boolean
}

export const WaveAnnounce: React.FC<WaveAnnounceProps> = ({ wave, visible }) => {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit' | 'hidden'>('hidden')
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    for (const t of timersRef.current) clearTimeout(t)
    timersRef.current = []
    if (visible && wave > 0) {
      setPhase('enter')
      timersRef.current.push(
        setTimeout(() => setPhase('hold'), 300),
        setTimeout(() => setPhase('exit'), 2000),
        setTimeout(() => setPhase('hidden'), 2500),
      )
    } else {
      setPhase('hidden')
    }
    return () => {
      for (const t of timersRef.current) clearTimeout(t)
      timersRef.current = []
    }
  }, [visible, wave])

  if (phase === 'hidden') return null

  const getScale = () => {
    switch (phase) {
      case 'enter': return 1.2
      case 'hold': return 1.0
      case 'exit': return 0.8
      default: return 1
    }
  }

  const getOpacity = () => {
    switch (phase) {
      case 'enter': return 1
      case 'hold': return 1
      case 'exit': return 0
      default: return 0
    }
  }

  return (
    <div style={{
      position: 'absolute',
      top: '30%',
      left: '50%',
      transform: `translate(-50%, -50%) scale(${getScale()})`,
      opacity: getOpacity(),
      transition: phase === 'enter'
        ? 'transform 0.3s ease-out, opacity 0.3s ease-out'
        : phase === 'exit'
          ? 'transform 0.5s ease-in, opacity 0.5s ease-in'
          : 'none',
      pointerEvents: 'none',
      textAlign: 'center',
      zIndex: 20,
    }}>
      <div style={{
        fontSize: 16,
        color: '#ff9900',
        textShadow: '0 0 10px #ff6600',
        marginBottom: 8,
        letterSpacing: 4,
        fontFamily: 'monospace',
      }}>
        WAVE
      </div>
      <div style={{
        fontSize: 72,
        fontWeight: 'bold',
        color: '#ff6600',
        textShadow: '0 0 30px #ff6600, 0 0 60px #ff3300',
        fontFamily: 'monospace',
        lineHeight: 1,
      }}>
        {wave}
      </div>
      {wave > 1 && (
        <div style={{
          fontSize: 14,
          color: '#ffcc00',
          marginTop: 12,
          textShadow: '0 0 8px #ff9900',
          fontFamily: 'monospace',
        }}>
          {wave >= 5 ? 'DANGER!' : wave >= 3 ? 'INCOMING!' : 'GET READY!'}
        </div>
      )}
    </div>
  )
}
