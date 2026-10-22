import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { headingFrom, packCurve } from '../comet'
import { INITIAL_STATE, type CometState } from '../schema'

const at = (x: number, y = 0, z = 0): CometState => ({ ...INITIAL_STATE, personality: { x, y, z } })

describe('headingFrom', () => {
  it('is null without history', () => {
    expect(headingFrom([])).toBeNull()
  })

  it('points from the origin to the first observation', () => {
    expect(headingFrom([at(0.5)])!.toArray()).toEqual([1, 0, 0])
  })

  it('uses the most recent move between observations', () => {
    const h = headingFrom([at(0.5), at(0.5, 0.4)])!
    expect(h.x).toBeCloseTo(0)
    expect(h.y).toBeCloseTo(1)
  })

  it('skips moves too small to have a direction', () => {
    const h = headingFrom([at(0.2), at(0.6), at(0.6)])!
    expect(h.x).toBeCloseTo(1)
  })

  it('is null when nothing has ever moved', () => {
    expect(headingFrom([at(0), at(0)])).toBeNull()
  })
})

describe('packCurve', () => {
  it('writes xyz1 texels and returns the count, clamped to the buffer', () => {
    const out = new Float32Array(2 * 4)
    const n = packCurve([new THREE.Vector3(1, 2, 3), new THREE.Vector3(4, 5, 6), new THREE.Vector3(7, 8, 9)], out)
    expect(n).toBe(2)
    expect(Array.from(out)).toEqual([1, 2, 3, 1, 4, 5, 6, 1])
  })
})
