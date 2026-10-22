import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { springStep } from '../comet'

const run = (position: THREE.Vector3, velocity: THREE.Vector3, target: THREE.Vector3, seconds: number, onStep?: () => void) => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    springStep(position, velocity, target, 1, 1 / 60)
    onStep?.()
  }
}

describe('springStep', () => {
  it('settles on the target without overshooting', () => {
    const p = new THREE.Vector3()
    const v = new THREE.Vector3()
    const target = new THREE.Vector3(10, 0, 0)
    let maxX = 0
    run(p, v, target, 8, () => (maxX = Math.max(maxX, p.x)))
    expect(p.distanceTo(target)).toBeLessThan(0.01)
    expect(maxX).toBeLessThanOrEqual(10 + 1e-6)
  })

  it('starts from rest and keeps its speed when the target changes', () => {
    const p = new THREE.Vector3()
    const v = new THREE.Vector3()
    springStep(p, v, new THREE.Vector3(10, 0, 0), 1, 1 / 60)
    expect(v.length()).toBeLessThan(1)

    run(p, v, new THREE.Vector3(10, 0, 0), 1)
    const before = v.length()
    // A new answer mid-flight: the comet keeps moving rather than stopping dead.
    springStep(p, v, new THREE.Vector3(10, 10, 0), 1, 1 / 60)
    expect(v.length()).toBeGreaterThan(before * 0.9)
  })

  it('respects the speed limit', () => {
    const p = new THREE.Vector3()
    const v = new THREE.Vector3()
    let fastest = 0
    for (let i = 0; i < 300; i++) {
      springStep(p, v, new THREE.Vector3(100, 0, 0), 1, 1 / 60, 5)
      fastest = Math.max(fastest, v.length())
    }
    expect(fastest).toBeLessThanOrEqual(5 * 1.05)
  })
})
