import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  SSAOEffect,
  SMAAEffect,
  ToneMappingEffect,
  NormalPass,
  BlendFunction,
  KernelSize,
  EdgeDetectionMode,
  SMAAAreaImageSource,
} from 'postprocessing'
import * as THREE from 'three'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

export type PostQuality = 'low' | 'medium' | 'high'

export class PostProcessing {
  composer: EffectComposer | null = null
  private preset: PostQuality
  private bloom: BloomEffect | null = null
  private ssao: SSAOEffect | null = null
  private smaa: SMAAEffect | null = null
  private toneMapping: ToneMappingEffect | null = null
  private normalPass: NormalPass | null = null
  private effectPass: EffectPass | null = null
  private disposed = false

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.preset = PLANETARY_CONFIG.post.defaultPreset as PostQuality
    try {
      this.composer = new EffectComposer(renderer)
      const renderPass = new RenderPass(scene, camera)
      this.composer.addPass(renderPass)

      this.normalPass = new NormalPass(scene, camera, {})
      this.bloom = new BloomEffect({
        blendFunction: BlendFunction.SCREEN,
        kernelSize: KernelSize.MEDIUM,
        luminanceThreshold: PLANETARY_CONFIG.post.bloomThreshold,
        luminanceSmoothing: 0.1,
        intensity: PLANETARY_CONFIG.post.bloomStrength,
      })
      this.ssao = new SSAOEffect(camera, this.normalPass.renderTarget.texture, {
        blendFunction: BlendFunction.MULTIPLY,
        samples: 16,
        rings: 4,
        radius: PLANETARY_CONFIG.post.ssaoRadius,
        intensity: 1.0,
        worldDistanceThreshold: 200,
        worldDistanceFalloff: 0.9,
      })
      this.smaa = new SMAAEffect(
        EdgeDetectionMode.COLOR,
        SMAAAreaImageSource.AREA_TEX,
        SMAAAreaImageSource.SEARCH_TEX,
      )
      this.toneMapping = new ToneMappingEffect({ mode: 2 /* ACES_FILMIC */ })

      this.rebuildEffectPass()
    } catch {
      this.composer = null
    }
  }

  private rebuildEffectPass(): void {
    if (!this.composer || !this.bloom || !this.ssao || !this.smaa || !this.toneMapping) return
    const oldPasses = this.composer.passes
    for (let i = oldPasses.length - 1; i >= 0; i--) {
      if (oldPasses[i] instanceof EffectPass) {
        this.composer.removePass(oldPasses[i])
      }
    }

    const effects: unknown[] = [this.toneMapping]
    if (this.preset !== 'low') {
      effects.unshift(this.smaa)
      effects.unshift(this.bloom)
    }
    effects.unshift(this.ssao)

    this.effectPass = new EffectPass(undefined as never, ...effects as never[])
    if (this.preset === 'low') {
      this.ssao.ssaoMaterial.uniforms.get('resolutionScale')!.value = 0.25
      this.ssao.ssaoMaterial.uniforms.get('samples')!.value = 8
    } else if (this.preset === 'high') {
      this.ssao.ssaoMaterial.uniforms.get('resolutionScale')!.value = 1.0
      this.ssao.ssaoMaterial.uniforms.get('samples')!.value = 32
    } else {
      this.ssao.ssaoMaterial.uniforms.get('resolutionScale')!.value = 0.5
      this.ssao.ssaoMaterial.uniforms.get('samples')!.value = 16
    }
    this.composer.addPass(this.effectPass)
  }

  setQuality(preset: PostQuality): void {
    if (preset === this.preset) return
    this.preset = preset
    this.rebuildEffectPass()
  }

  render(dt: number): void {
    if (this.disposed || !this.composer) return
    this.composer.render(dt)
  }

  dispose(): void {
    this.disposed = true
    this.composer?.dispose()
    this.composer = null
    this.bloom?.dispose()
    this.ssao?.dispose()
    this.smaa?.dispose()
    this.toneMapping?.dispose()
    this.normalPass?.dispose()
  }
}
