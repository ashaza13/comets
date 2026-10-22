import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { BAND_NORMAL, axisLabelVisibility, generateStars } from '../sky'

describe('generateStars', () => {
  it('is deterministic for a seed', () => {
    const a = generateStars({ count: 50, seed: 1 })
    const b = generateStars({ count: 50, seed: 1 })
    expect(a.positions).toEqual(b.positions)
    expect(generateStars({ count: 50, seed: 2 }).positions).not.toEqual(a.positions)
  })

  it('places stars between the radii with sane sizes and colours', () => {
    const { positions, sizes, colors } = generateStars({ count: 500, minRadius: 30, maxRadius: 80 })
    for (let i = 0; i < 500; i++) {
      const r = Math.hypot(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      expect(r).toBeGreaterThanOrEqual(29.99)
      expect(r).toBeLessThanOrEqual(80.01)
      expect(sizes[i]).toBeGreaterThan(1)
      expect(sizes[i]).toBeLessThan(6)
    }
    expect(Math.max(...colors)).toBeLessThanOrEqual(1)
  })

  it('concentrates stars along the galactic band', () => {
    const near = (bandFraction: number) => {
      const { positions } = generateStars({ count: 4000, bandFraction })
      let n = 0
      const v = new THREE.Vector3()
      for (let i = 0; i < 4000; i++) {
        v.fromArray(positions, i * 3).normalize()
        if (Math.abs(v.dot(BAND_NORMAL)) < 0.15) n++
      }
      return n / 4000
    }
    expect(near(0.5)).toBeGreaterThan(near(0) * 2)
  })
})

describe('axisLabelVisibility', () => {
  it('hides labels when the axis points at the camera and shows them side-on', () => {
    const x = new THREE.Vector3(1, 0, 0)
    expect(axisLabelVisibility(x, new THREE.Vector3(1, 0, 0))).toBe(0)
    expect(axisLabelVisibility(x, new THREE.Vector3(-1, 0, 0))).toBe(0)
    expect(axisLabelVisibility(x, new THREE.Vector3(0, 0, -1))).toBe(1)
  })
})
