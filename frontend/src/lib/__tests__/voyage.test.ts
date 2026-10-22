import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createVoyage, fly, legLength, settle, steer } from '../voyage'

const line = (n: number) => new THREE.CatmullRomCurve3(Array.from({ length: n }, (_, i) => new THREE.Vector3(i * 4, 0, 0)))

describe('voyage', () => {
  it('flies each leg to the end of the curve and stops there', () => {
    const v = createVoyage()
    const curve = line(3)
    const target = new THREE.Vector3()
    steer(v, curve, 3, 0, () => 0.5)
    expect(v.active).toBe(true)
    fly(v, curve, 3, v.duration + 1, target)
    expect(v.u).toBe(2)
    expect(v.active).toBe(false)
    expect(target.distanceTo(new THREE.Vector3(8, 0, 0))).toBeLessThan(1e-6)
  })

  it('takes a different time for the same leg at different speeds', () => {
    const durations = [0, 0.5, 1].map((r) => {
      const v = createVoyage()
      steer(v, line(8), 8, 0, () => r)
      return v.duration
    })
    expect(new Set(durations).size).toBe(3)
  })

  it('carries straight on when an answer arrives mid-flight', () => {
    const v = createVoyage()
    const target = new THREE.Vector3()
    steer(v, line(3), 3, 0, () => 0.5)
    fly(v, line(3), 3, v.duration * 0.4, target)
    const u = v.u
    // The curve grows: the next leg starts where the comet is, already moving.
    steer(v, line(5), 5, v.duration * 0.4, () => 0.5)
    expect(v.from).toBe(u)
    expect(v.cruising).toBe(true)
  })

  it('measures legs along the curve', () => {
    expect(legLength(line(3), 3, 0, 2)).toBeCloseTo(8, 1)
    const v = createVoyage()
    settle(v, 1.5)
    expect([v.u, v.to, v.active]).toEqual([1.5, 1.5, false])
  })
})
