export const PLANETARY_CONFIG = {
  shadows: {
    cascadeCount: 4,
    cascadeResolution: 1024,
    cascadeSplits: [20, 60, 180, 600] as number[],
  },
  post: {
    defaultPreset: 'medium' as 'low' | 'medium' | 'high',
    ssaoRadius: 5,
    bloomThreshold: 1.0,
    bloomStrength: 0.5,
  },
  terrain: {
    gridResolution: 2,
    gridRadius: 500,
    refreshDistance: 100,
  },
  building: {
    minHeight: 3,
  },
}
