import { describe, expect, it } from 'vitest'
import { groupIdFromSearch, likeness, sharedInterests, shareUrl } from '../groups'

describe('constellation links', () => {
  it('reads a well-formed group id and ignores anything else', () => {
    expect(groupIdFromSearch('?c=k7f2qAb9Zx')).toBe('k7f2qAb9Zx')
    expect(groupIdFromSearch('?debug&c=k7f2qAb9Zx')).toBe('k7f2qAb9Zx')
    expect(groupIdFromSearch('?c=short')).toBeNull()
    expect(groupIdFromSearch('?c=k7f2qAb9Z/')).toBeNull()
    expect(groupIdFromSearch('')).toBeNull()
  })

  it('builds the link a friend opens', () => {
    expect(shareUrl('k7f2qAb9Zx', 'https://comets.app')).toBe('https://comets.app/?c=k7f2qAb9Zx')
  })
})

describe('likeness', () => {
  it('is 1 for the same place and 0 for opposite corners', () => {
    const p = { x: 0.3, y: -0.2, z: 0.8 }
    expect(likeness(p, p)).toBe(1)
    expect(likeness({ x: -1, y: -1, z: -1 }, { x: 1, y: 1, z: 1 })).toBeCloseTo(0)
    expect(likeness({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })).toBeCloseTo(0.5)
  })
})

describe('sharedInterests', () => {
  it('lists interests both hold, strongest first', () => {
    expect(sharedInterests({ music: 0.3, art: 0.9, film: 0.4 }, { art: 0.5, music: 0.6, cooking: 1 })).toEqual(['art', 'music'])
    expect(sharedInterests({ music: 0.3 }, { music: 0.01 })).toEqual([])
  })
})
