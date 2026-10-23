import type { CometState } from './schema'

/**
 * Star types: a playful identity from where the comet sits. One per octant of
 * the personality space (introvert/extrovert × concrete/abstract ×
 * practical/imaginative), so they're roughly balanced, plus a balanced type
 * for comets near the centre. Derived from the current reading, so it can
 * change as the orbit drifts.
 */
export interface StarType {
  id: string
  name: string
  /** Colour of the star, for its swatch and the share text. */
  color: string
  emoji: string
  blurb: string
}

export const STAR_TYPES: StarType[] = [
  { id: 'supernova', name: 'Supernova', color: '#ffb36b', emoji: '💥', blurb: 'Outgoing, idea-hungry and imaginative: you light up every room you enter.' },
  { id: 'blue-giant', name: 'Blue Giant', color: '#8fb5ff', emoji: '🔵', blurb: 'Big, bright and cerebral: you draw people in and love a hard problem.' },
  { id: 'red-giant', name: 'Red Giant', color: '#ff8a6b', emoji: '🔴', blurb: 'Warm and expansive: sociable, grounded and full of colour.' },
  { id: 'yellow-sun', name: 'Yellow Sun', color: '#ffd76b', emoji: '🟡', blurb: 'Steady and life-giving: social, practical, the one others orbit.' },
  { id: 'pulsar', name: 'Pulsar', color: '#c39bff', emoji: '🟣', blurb: 'Quiet but intense: abstract, imaginative, sending signals across the dark.' },
  { id: 'white-dwarf', name: 'White Dwarf', color: '#e8eefc', emoji: '⚪', blurb: 'Dense and brilliant: inward-looking, precise, drawn to ideas.' },
  { id: 'nebula', name: 'Nebula', color: '#7fd6c8', emoji: '🟢', blurb: 'A nursery of stars: reserved, down to earth, quietly imaginative.' },
  { id: 'red-dwarf', name: 'Red Dwarf', color: '#d96b5a', emoji: '🟤', blurb: 'The most common star there is: calm, practical and long-burning.' },
  { id: 'binary', name: 'Binary Star', color: '#f2e6c8', emoji: '✨', blurb: 'Balanced between poles: two stars in one, at home anywhere.' },
]

export const STAR_BY_ID: Record<string, StarType> = Object.fromEntries(STAR_TYPES.map((s) => [s.id, s]))

// Within this distance of the centre on every axis, a comet is balanced.
const BALANCED = 0.15

export function starType(personality: CometState['personality']): StarType {
  const { x, y, z } = personality
  if (Math.abs(x) < BALANCED && Math.abs(y) < BALANCED && Math.abs(z) < BALANCED) return STAR_BY_ID.binary
  const octant = `${x >= 0 ? '+' : '-'}${y >= 0 ? '+' : '-'}${z >= 0 ? '+' : '-'}`
  const id = {
    '+++': 'supernova',
    '++-': 'blue-giant',
    '+-+': 'red-giant',
    '+--': 'yellow-sun',
    '-++': 'pulsar',
    '-+-': 'white-dwarf',
    '--+': 'nebula',
    '---': 'red-dwarf',
  }[octant]!
  return STAR_BY_ID[id]
}
