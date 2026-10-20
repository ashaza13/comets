// This-or-that cards. Each option carries readings on the personality axes it
// speaks to (−1…1, same meaning as spec.json): x introvert → extrovert,
// y concrete → abstract, z analytical → creative. Axes an option says nothing
// about are left out. The wording is the measurement, so review it with care.

export type AxisKey = 'x' | 'y' | 'z'
export type Loadings = Partial<Record<AxisKey, number>>

export interface CardOption {
  label: string
  loadings: Loadings
}

export interface Card {
  id: string
  prompt: string
  a: CardOption
  b: CardOption
}

export const CARDS: Card[] = [
  // Social orientation (x)
  { id: 'friday', prompt: 'Friday night, nothing planned.', a: { label: 'Text everyone, see who’s out', loadings: { x: 0.7 } }, b: { label: 'Finally, a quiet night in', loadings: { x: -0.7 } } },
  { id: 'recharge', prompt: 'After a long week, you recharge by…', a: { label: 'Being around people', loadings: { x: 0.7 } }, b: { label: 'Being on your own', loadings: { x: -0.7 } } },
  { id: 'party', prompt: 'At a party where you know one person…', a: { label: 'You’ll meet half the room', loadings: { x: 0.6 } }, b: { label: 'You stay close to them', loadings: { x: -0.6 } } },
  { id: 'workspace', prompt: 'Your ideal place to work', a: { label: 'A buzzing shared studio', loadings: { x: 0.5 } }, b: { label: 'A room with a door that closes', loadings: { x: -0.5 } } },
  { id: 'win', prompt: 'You’ve had a big win. First instinct?', a: { label: 'Call someone right away', loadings: { x: 0.6 } }, b: { label: 'Savour it quietly first', loadings: { x: -0.6 } } },
  { id: 'project', prompt: 'Group project, day one', a: { label: 'Get everyone talking', loadings: { x: 0.6 } }, b: { label: 'Take a piece and go deep', loadings: { x: -0.5 } } },
  { id: 'train', prompt: 'A long train ride', a: { label: 'Chat with whoever sits beside you', loadings: { x: 0.7 } }, b: { label: 'Headphones on, window seat', loadings: { x: -0.7 } } },
  { id: 'city', prompt: 'A free afternoon in a new city', a: { label: 'Join a walking tour', loadings: { x: 0.5, y: -0.1 } }, b: { label: 'Wander alone without a map', loadings: { x: -0.5, z: 0.2 } } },

  // Cognitive style (y)
  { id: 'question', prompt: 'Which question pulls you in?', a: { label: 'How does this actually work?', loadings: { y: -0.6 } }, b: { label: 'Why does this exist at all?', loadings: { y: 0.7 } } },
  { id: 'book', prompt: 'A good book is one that…', a: { label: 'Teaches you something you can use', loadings: { y: -0.6 } }, b: { label: 'Changes how you see things', loadings: { y: 0.6 } } },
  { id: 'explain', prompt: 'Explaining something, you reach for…', a: { label: 'A concrete example', loadings: { y: -0.6 } }, b: { label: 'The big idea behind it', loadings: { y: 0.6 } } },
  { id: 'trip', prompt: 'Planning a trip', a: { label: 'Bookings, routes, a packing list', loadings: { y: -0.6, z: -0.2 } }, b: { label: 'A feeling of where you want to be', loadings: { y: 0.5, z: 0.2 } } },
  { id: 'talk', prompt: 'You’d rather talk about…', a: { label: 'What happened', loadings: { y: -0.6 } }, b: { label: 'What it means', loadings: { y: 0.6 } } },
  { id: 'satisfying', prompt: 'Which feels more satisfying?', a: { label: 'Fixing something broken', loadings: { y: -0.6 } }, b: { label: 'Understanding something confusing', loadings: { y: 0.6 } } },
  { id: 'museum', prompt: 'Pick a museum', a: { label: 'Engines, tools and inventions', loadings: { y: -0.5, z: -0.2 } }, b: { label: 'Philosophy and ancient myths', loadings: { y: 0.6 } } },
  { id: 'advice', prompt: 'Advice you trust most comes from…', a: { label: 'Someone who’s done it', loadings: { y: -0.6 } }, b: { label: 'Someone who’s thought hard about it', loadings: { y: 0.5 } } },

  // Engagement mode (z)
  { id: 'decision', prompt: 'Facing a hard decision', a: { label: 'List the pros and cons', loadings: { z: -0.7 } }, b: { label: 'Go with what feels right', loadings: { z: 0.6 } } },
  { id: 'toy', prompt: 'Pick one to play with', a: { label: 'A puzzle with one right answer', loadings: { z: -0.7 } }, b: { label: 'A box of paints', loadings: { z: 0.7 } } },
  { id: 'cooking', prompt: 'Cooking dinner', a: { label: 'Follow the recipe exactly', loadings: { z: -0.6, y: -0.2 } }, b: { label: 'Improvise with what’s there', loadings: { z: 0.6 } } },
  { id: 'beauty', prompt: 'Something beautiful is…', a: { label: 'Elegant and precise', loadings: { z: -0.6 } }, b: { label: 'Surprising and expressive', loadings: { z: 0.6 } } },
  { id: 'notes', prompt: 'Your notes look like…', a: { label: 'Neat lists and headings', loadings: { z: -0.6 } }, b: { label: 'Sketches and arrows everywhere', loadings: { z: 0.6 } } },
  { id: 'broken', prompt: 'When something breaks', a: { label: 'Find the cause, step by step', loadings: { z: -0.7 } }, b: { label: 'Try something new and see', loadings: { z: 0.5 } } },
  { id: 'compliment', prompt: 'Which compliment lands better?', a: { label: '“That was so clear”', loadings: { z: -0.6 } }, b: { label: '“That was so original”', loadings: { z: 0.7 } } },
  { id: 'class', prompt: 'A free class — pick one', a: { label: 'Data and statistics', loadings: { z: -0.6, y: -0.1 } }, b: { label: 'Improv theatre', loadings: { z: 0.6, x: 0.3 } } },

  // Mixed
  { id: 'sunday', prompt: 'A perfect Sunday', a: { label: 'Brunch with a crowd, then a gallery', loadings: { x: 0.5, z: 0.3 } }, b: { label: 'A solo hike and a documentary', loadings: { x: -0.5, y: -0.1 } } },
  { id: 'known', prompt: 'You’d rather be known as…', a: { label: 'The one who brings people together', loadings: { x: 0.5 } }, b: { label: 'The one with unusual ideas', loadings: { y: 0.3, z: 0.4 } } },
  { id: 'hobby', prompt: 'A new hobby', a: { label: 'Learning to code', loadings: { z: -0.5, y: -0.2 } }, b: { label: 'Learning to write poetry', loadings: { z: 0.5, y: 0.3 } } },
  { id: 'debate', prompt: 'In a debate you lean on…', a: { label: 'Evidence and numbers', loadings: { z: -0.6, y: -0.2 } }, b: { label: 'Stories and principles', loadings: { z: 0.3, y: 0.4 } } },
  { id: 'photos', prompt: 'Your camera roll is mostly…', a: { label: 'Friends and gatherings', loadings: { x: 0.6 } }, b: { label: 'Skies, textures and odd details', loadings: { x: -0.3, z: 0.5 } } },
  { id: 'job', prompt: 'A dream job', a: { label: 'Running a busy restaurant', loadings: { x: 0.5, y: -0.4 } }, b: { label: 'Researching deep space', loadings: { x: -0.3, y: 0.5 } } },
]

const AXIS_KEYS: AxisKey[] = ['x', 'y', 'z']

/**
 * How much a card can tell us right now: how strongly its two options pull
 * apart on each axis, weighted by how unsure we still are about that axis.
 */
export function cardInformation(card: Card, uncertainty: Record<AxisKey, number>): number {
  return AXIS_KEYS.reduce((sum, axis) => {
    const spread = Math.abs((card.a.loadings[axis] ?? 0) - (card.b.loadings[axis] ?? 0))
    return sum + spread * uncertainty[axis]
  }, 0)
}

/** The most informative unused card, ties broken by bank order; null when none remain. */
export function nextCard(used: Set<string>, uncertainty: Record<AxisKey, number>): Card | null {
  let best: Card | null = null
  let bestScore = -Infinity
  for (const card of CARDS) {
    if (used.has(card.id)) continue
    const score = cardInformation(card, uncertainty)
    if (score > bestScore + 1e-9) {
      best = card
      bestScore = score
    }
  }
  return best
}
