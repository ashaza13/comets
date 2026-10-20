import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import bakeFragment from '../shaders/nebula.frag'
import bakeVertex from '../shaders/nebula.vert'
import displayFragment from '../shaders/nebulaDisplay.frag'
import displayVertex from '../shaders/nebulaDisplay.vert'
import { BAND_NORMAL } from '../lib/sky'
import { useReducedMotion } from '../hooks/useReducedMotion'

const CUBE_SIZE = 512
const SKY_RADIUS = 400
// The whole sky turns very slowly, about one revolution an hour.
const DRIFT_RADIANS_PER_SECOND = (Math.PI * 2) / 3600

interface Bake {
  target: THREE.WebGLCubeRenderTarget
  camera: THREE.CubeCamera
  scene: THREE.Scene
  dispose: () => void
}

/**
 * Procedural nebula backdrop. The expensive noise is baked once into a cube map
 * of structure layers; a cheap per-frame shader colours it, tints it with the
 * person's average mood and slowly rotates it.
 */
export function Nebula({ tint, intensity = 1 }: { tint: THREE.Color; intensity?: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.ShaderMaterial>(null)
  const bake = useRef<Bake | null>(null)
  const baked = useRef(false)
  const reducedMotion = useReducedMotion()
  const axis = useMemo(() => BAND_NORMAL.clone(), [])
  const rotation = useMemo(() => new THREE.Matrix4(), [])

  const uniforms = useMemo(
    () => ({
      uLayers: { value: null as THREE.CubeTexture | null },
      uTint: { value: new THREE.Color() },
      uIntensity: { value: intensity },
      uRotation: { value: new THREE.Matrix3() },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial values only; updated per frame
    [],
  )

  // GPU resources are created in an effect so StrictMode's remount gets fresh ones.
  useEffect(() => {
    const target = new THREE.WebGLCubeRenderTarget(CUBE_SIZE, { type: THREE.HalfFloatType, generateMipmaps: false })
    const camera = new THREE.CubeCamera(1, 100, target)
    const bakeMaterial = new THREE.ShaderMaterial({
      vertexShader: bakeVertex,
      fragmentShader: bakeFragment,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uBandNormal: { value: BAND_NORMAL.clone() }, uSeed: { value: 3.7 } },
    })
    const geometry = new THREE.SphereGeometry(50, 64, 32)
    const scene = new THREE.Scene()
    scene.add(new THREE.Mesh(geometry, bakeMaterial))
    bake.current = {
      target,
      camera,
      scene,
      dispose: () => {
        target.dispose()
        bakeMaterial.dispose()
        geometry.dispose()
      },
    }
    baked.current = false
    return () => {
      bake.current?.dispose()
      bake.current = null
    }
  }, [])

  useFrame(({ gl, camera, clock }, delta) => {
    const b = bake.current
    const m = material.current
    if (!b || !m || !mesh.current) return
    if (!baked.current) {
      b.camera.update(gl, b.scene)
      m.uniforms.uLayers.value = b.target.texture
      baked.current = true
    }
    // Centred on the camera so the backdrop behaves as if infinitely far away.
    mesh.current.position.copy(camera.position)
    easing.dampC(m.uniforms.uTint.value, tint, 1.5, delta)
    m.uniforms.uIntensity.value = intensity
    const angle = reducedMotion ? 0 : clock.getElapsedTime() * DRIFT_RADIANS_PER_SECOND
    m.uniforms.uRotation.value.setFromMatrix4(rotation.makeRotationAxis(axis, angle))
  })

  return (
    <mesh ref={mesh} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[SKY_RADIUS, 48, 24]} />
      <shaderMaterial
        ref={material}
        vertexShader={displayVertex}
        fragmentShader={displayFragment}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  )
}
