import { describe, expect, it } from 'vitest'
import { freeAreaCentre } from '../framing'

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
