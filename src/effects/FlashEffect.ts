export interface FlashEffectState {
  active: boolean
  opacity: number
  duration: number
  elapsed: number
}

export function createFlashEffect(): FlashEffectState {
  return { active: false, opacity: 0, duration: 0, elapsed: 0 }
}

export function triggerFlash(state: FlashEffectState, duration: number): FlashEffectState {
  return { active: true, opacity: 1, duration, elapsed: 0 }
}

export function updateFlash(state: FlashEffectState, dt: number): FlashEffectState {
  if (!state.active) return state

  const elapsed = state.elapsed + dt
  if (elapsed >= state.duration) {
    return { active: false, opacity: 0, duration: 0, elapsed: 0 }
  }

  const fadeStart = state.duration * 0.3
  let opacity: number
  if (elapsed < 0.1) {
    opacity = elapsed / 0.1
  } else if (elapsed < fadeStart) {
    opacity = 1
  } else {
    opacity = 1 - (elapsed - fadeStart) / (state.duration - fadeStart)
  }

  return { active: true, opacity: Math.max(0, Math.min(1, opacity)), duration: state.duration, elapsed }
}