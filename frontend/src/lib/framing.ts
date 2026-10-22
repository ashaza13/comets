// Kept free of three.js and the DOM so it can be unit-tested; rectangles are
// anything with DOMRect's fields.
type Rect = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>

// A panel across the screen's vertical midline sits above or below the comet;
// anything else is off to one side.
const spansMiddle = (canvas: Rect, r: Rect) => r.left < canvas.left + canvas.width / 2 && r.right > canvas.left + canvas.width / 2

/**
 * Where on the canvas the followed comet should sit (0–1 fractions): the centre
 * of the largest area no overlay covers. A wide panel along the bottom or top
 * leaves the area above or below it; a panel down one side leaves the other side.
 */
export function freeAreaCentre(canvas: Rect, overlays: Rect[]): { x: number; y: number } {
  let left = canvas.left
  let right = canvas.right
  let top = canvas.top
  let bottom = canvas.bottom
  for (const r of overlays) {
    if (r.width === 0 || r.height === 0) continue
    if (spansMiddle(canvas, r)) {
      // Above or below the comet: keep whichever side is taller.
      if (r.top - top >= bottom - r.bottom) bottom = Math.min(bottom, r.top)
      else top = Math.max(top, r.bottom)
    } else if (r.left - left >= right - r.right) right = Math.min(right, r.left)
    else left = Math.max(left, r.right)
  }
  // Don't push the comet against an edge if almost nothing is left free.
  if (right - left < canvas.width * 0.25 || bottom - top < canvas.height * 0.25) return { x: 0.5, y: 0.5 }
  return {
    x: ((left + right) / 2 - canvas.left) / canvas.width,
    y: ((top + bottom) / 2 - canvas.top) / canvas.height,
  }
}

/**
 * The screen's centre, moved only as far as needed to keep the comet (and
 * `clearance` pixels of glow around it) clear of the overlays: used while
 * answering, so the comet stays in the middle unless a panel reaches it. Each
 * covering panel is cleared by the shortest move up, down, left or right.
 */
export function clearCentre(canvas: Rect, overlays: Rect[], clearance: number): { x: number; y: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
  const clampX = (v: number) => clamp(v, canvas.left + clearance, canvas.right - clearance)
  const clampY = (v: number) => clamp(v, canvas.top + clearance, canvas.bottom - clearance)
  const covers = (r: Rect, x: number, y: number) =>
    x + clearance > r.left && x - clearance < r.right && y + clearance > r.top && y - clearance < r.bottom

  let x = canvas.left + canvas.width / 2
  let y = canvas.top + canvas.height / 2
  for (const r of overlays) {
    if (r.width === 0 || r.height === 0 || !covers(r, x, y)) continue
    const moves = [
      { x, y: clampY(r.top - clearance) },
      { x, y: clampY(r.bottom + clearance) },
      { x: clampX(r.left - clearance), y },
      { x: clampX(r.right + clearance), y },
    ]
    // The shortest move that clears the panel; if none can (it fills the
    // screen), stay put rather than jump to an edge.
    const clearing = moves.filter((m) => !covers(r, m.x, m.y))
    if (clearing.length === 0) continue
    const best = clearing.reduce((a, b) => (Math.hypot(b.x - x, b.y - y) < Math.hypot(a.x - x, a.y - y) ? b : a))
    x = best.x
    y = best.y
  }
  return { x: (x - canvas.left) / canvas.width, y: (y - canvas.top) / canvas.height }
}
