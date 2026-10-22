import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createWarp, flashEnvelope, jumpEnvelope, nextRegion, triggerJump, updateWarp } from '../warp'

describe('hyperspace jumps', () => {
  it('punches into full warp, holds, then drops out', () => {
    expect(jumpEnvelope(-1)).toBe(0)
    expect(jumpEnvelope(Infinity)).toBe(0)
    expect(jumpEnvelope(0.15)).toBeGreaterThan(0.3)
    expect(jumpEnvelope(0.8)).toBe(1)
    expect(jumpEnvelope(2.0)).toBeLessThan(1)
    expect(jumpEnvelope(3.0)).toBe(0)
  })

  it('flashes at the start of a jump and fades fast', () => {
    expect(flashEnvelope(0.08)).toBeCloseTo(1)
    expect(flashEnvelope(1)).toBeLessThan(0.02)
  })

  it('arrives in a new region of sky, 50–120° away', () => {
    const from = new THREE.Quaternion()
    for (let seed = 0; seed < 20; seed++) {
      let i = seed
      const rand = () => ((i = (i * 9301 + 49297) % 233280) / 233280)
      const angle = THREE.MathUtils.radToDeg(from.angleTo(nextRegion(from, rand)))
      expect(angle).toBeGreaterThanOrEqual(49.9)
      expect(angle).toBeLessThanOrEqual(120.1)
    }
  })

  it('turns the sky over the jump and settles there', () => {
    const warp = createWarp()
    triggerJump(warp, 10, () => 0.5)
    updateWarp(warp, 10.05, 0.05, 0, false)
    expect(warp.sky.angleTo(warp.skyFrom)).toBeLessThan(0.01)
    for (let t = 10.1; t < 14; t += 1 / 60) updateWarp(warp, t, 1 / 60, 0, false)
    expect(warp.sky.angleTo(warp.skyTo)).toBeLessThan(1e-6)
    expect(warp.level).toBeLessThan(0.01)
  })

  it('stays out of hyperspace with reduced motion, but still moves on', () => {
    const warp = createWarp()
    triggerJump(warp, 0, () => 0.3)
    updateWarp(warp, 0.5, 1 / 60, 1, true)
    expect(warp.level).toBe(0)
    expect(warp.flash).toBe(0)
    expect(warp.sky.angleTo(warp.skyTo)).toBeLessThan(1e-6)
  })
})
