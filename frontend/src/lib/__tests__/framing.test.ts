import { describe, expect, it } from 'vitest'
import { clearCentre, freeAreaCentre } from '../framing'

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height })
const canvas = rect(0, 0, 400, 800)

describe('freeAreaCentre', () => {
  it('is the centre when nothing covers the canvas', () => {
    expect(freeAreaCentre(canvas, [])).toEqual({ x: 0.5, y: 0.5 })
  })

  it('moves above a panel along the bottom', () => {
    expect(freeAreaCentre(canvas, [rect(12, 400, 376, 388)])).toEqual({ x: 0.5, y: 0.25 })
  })

  it('moves below a card across the top', () => {
    expect(freeAreaCentre(canvas, [rect(12, 12, 376, 288)]).y).toBeCloseTo(0.6875)
  })

  it('moves beside a panel docked to one side', () => {
    const wide = rect(0, 0, 800, 400)
    expect(freeAreaCentre(wide, [rect(400, 12, 388, 376)])).toEqual({ x: 0.25, y: 0.5 })
  })

  it('stays centred when an overlay leaves almost no room', () => {
    expect(freeAreaCentre(canvas, [rect(0, 60, 400, 730)])).toEqual({ x: 0.5, y: 0.5 })
  })
})

describe('clearCentre', () => {
  const desk = rect(0, 0, 1000, 800)

  it('stays at the middle of the screen when the panel is below it', () => {
    expect(clearCentre(desk, [rect(200, 520, 600, 256)], 56)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('rises only as far as needed when a tall panel reaches the middle', () => {
    // Panel top at 380: the comet sits 56px above it rather than mid-way up the free space.
    expect(clearCentre(desk, [rect(200, 380, 600, 400)], 56).y).toBeCloseTo((380 - 56) / 800)
  })

  it('moves aside from a panel docked to the right', () => {
    const wide = rect(0, 0, 844, 390)
    expect(clearCentre(wide, [rect(412, 12, 420, 366)], 56).x).toBeCloseTo((412 - 56) / 844)
  })

  it('stays centred when a panel fills the screen and nothing would clear it', () => {
    expect(clearCentre(canvas, [rect(12, 60, 376, 730)], 56)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('keeps its clearance from the screen edge', () => {
    expect(clearCentre(canvas, [rect(12, 120, 376, 670)], 56).y).toBeCloseTo(64 / 800)
  })
})
