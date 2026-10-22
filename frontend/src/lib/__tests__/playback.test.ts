import { describe, expect, it } from 'vitest'
import { historyAt, lerpState } from '../playback'
import { INITIAL_STATE, type CometState } from '../schema'

const at = (x: number, hue: number, interests: Record<string, number> = {}): CometState => ({
  ...INITIAL_STATE,
  personality: { x, y: 0, z: 0 },
  emotion: { hue, saturation: 0.5, lightness: 0.5 },
  interests,
})

const history = [at(0.2, 60), at(0.6, 120, { music: 0.4 }), at(-0.2, 200)]

describe('historyAt', () => {
  it('returns the full history when live or past the end', () => {
    expect(historyAt(history, null)).toBe(history)
    expect(historyAt(history, 3)).toBe(history)
  })

  it('returns only the answers passed at whole-number playheads', () => {
    expect(historyAt(history, 0)).toEqual([])
    expect(historyAt(history, 2)).toEqual(history.slice(0, 2))
  })

  it('adds an interpolated state between answers', () => {
    const shown = historyAt(history, 1.5)
    expect(shown).toHaveLength(2)
    expect(shown[1].personality.x).toBeCloseTo(0.4)
    expect(shown[1].interests.music).toBeCloseTo(0.2)
  })

  it('starts the journey from the initial state', () => {
    expect(historyAt(history, 0.5)[0].personality.x).toBeCloseTo(0.1)
  })
})

describe('lerpState', () => {
  it('interpolates hue the short way round', () => {
    expect(lerpState(at(0, 350), at(0, 10), 0.5).emotion.hue).toBeCloseTo(0)
  })
})

describe('journeyPath', () => {
  it('passes through the origin and every observation at its knot', async () => {
    const { journeyPath } = await import('../playback')
    const { toWorld } = await import('../tail')
    const path = journeyPath(history)!
    expect(path.curve.getPoint(path.knots[0]).length()).toBeCloseTo(0)
    history.forEach((s, i) => {
      expect(path.curve.getPoint(path.knots[i + 1]).distanceTo(toWorld(s.personality))).toBeLessThan(1e-6)
    })
  })

  it('gives answers that did not move the comet the same knot, and maps playheads both ways', async () => {
    const { journeyPath, playheadToT, tToPlayhead } = await import('../playback')
    // origin, stay (mood), move, stay (skip), move
    const path = journeyPath([at(0, 60), at(0.5, 60), at(0.5, 60), at(-0.2, 60)])!
    expect(path.knots).toEqual([0, 0, 0.5, 0.5, 1])
    expect(playheadToT(path, 1.5)).toBeCloseTo(0.25)
    expect(tToPlayhead(path, 0.25)).toBeCloseTo(1.5)
    // Arriving at a shared place passes every answer there.
    expect(tToPlayhead(path, 0.5)).toBe(3)
    expect(tToPlayhead(path, 1)).toBe(4)
  })

  it('is null when there is nowhere to travel', async () => {
    const { journeyPath } = await import('../playback')
    expect(journeyPath([])).toBeNull()
    expect(journeyPath([at(0, 60)])).toBeNull()
  })
})

describe('replay motion', () => {
  it('moves at a steady speed with no sharp turns, even through zig-zags', async () => {
    const { journeyPath, easeReplay } = await import('../playback')
    const p = (x: number, y: number, z: number) => ({ ...at(0, 0), personality: { x, y, z } })
    // Sharp 3D turns (90°+ between legs), plus a step that doesn't move.
    const zigzag = [p(0.4, 0.1, 0), p(0.3, 0.5, 0.2), p(-0.2, 0.3, 0.5), p(-0.2, 0.3, 0.5), p(-0.1, -0.3, 0.1), p(0.4, -0.2, -0.3)]
    const { curve } = journeyPath(zigzag)!
    const steps = 1500
    const points = Array.from({ length: steps + 1 }, (_, i) => curve.getPoint(curve.getUtoTmapping(i / steps, 0)))
    const lengths = points.slice(1).map((p, i) => p.distanceTo(points[i]))
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length
    // Constant speed by arc length: every step within 5% of the mean.
    for (const l of lengths) expect(Math.abs(l - mean) / mean).toBeLessThan(0.05)
    // Smooth direction: no step turns by more than 20 degrees.
    for (let i = 1; i < steps; i++) {
      const a = points[i].clone().sub(points[i - 1]).normalize()
      const b = points[i + 1].clone().sub(points[i]).normalize()
      expect((Math.acos(Math.min(1, a.dot(b))) * 180) / Math.PI).toBeLessThan(20)
    }
    expect(easeReplay(0)).toBe(0)
    expect(easeReplay(1)).toBe(1)
  })
})

describe('journey detours', () => {
  const axisMoves = [at(0.2, 60), at(0.4, 60), at(0.6, 60)]
  const ids = ['a1', 'b2', 'c3']

  it('replays the same route for the same answers', async () => {
    const { journeyPath } = await import('../playback')
    const a = journeyPath(axisMoves, ids)!
    const b = journeyPath(axisMoves, ids)!
    expect(a.points.map((p) => p.toArray())).toEqual(b.points.map((p) => p.toArray()))
    const other = journeyPath(axisMoves, ['x', 'y', 'z'])!
    expect(other.points[1].distanceTo(a.points[1])).toBeGreaterThan(0.1)
  })

  it('wanders off the axis even when every answer moves along it', async () => {
    const THREE = await import('three')
    const { journeyPath } = await import('../playback')
    const { curve } = journeyPath(axisMoves, ids)!
    // How far the route strays from the x axis it nominally travels along.
    const strays = Array.from({ length: 200 }, (_, i) => {
      const p = curve.getPoint(i / 199)
      return new THREE.Vector2(p.y, p.z).length()
    })
    expect(Math.max(...strays)).toBeGreaterThan(1.5)
  })

  it('sends each move off in its own direction', async () => {
    const THREE = await import('three')
    const { journeyPath } = await import('../playback')
    const { points } = journeyPath(axisMoves, ids)!
    // One detour per short move: points are origin, d1, A1, d2, A2, d3, A3.
    const sideways = (i: number) => new THREE.Vector3(0, points[i].y, points[i].z).normalize()
    const angles = [sideways(1).angleTo(sideways(3)), sideways(3).angleTo(sideways(5))]
    expect(Math.max(...angles)).toBeGreaterThan(0.3)
  })

  it('detours a long move twice, keeping every detour near the move', async () => {
    const THREE = await import('three')
    const { detourPoints } = await import('../playback')
    const { mulberry32 } = await import('../sky')
    const from = new THREE.Vector3()
    const to = new THREE.Vector3(12, 0, 0)
    const points = detourPoints(from, to, mulberry32(7))
    expect(points).toHaveLength(2)
    for (const p of points) expect(p.distanceTo(from.clone().lerp(to, 0.5))).toBeLessThan(12)
  })
})
