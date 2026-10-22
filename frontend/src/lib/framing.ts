// Kept free of three.js and the DOM so it can be unit-tested; rectangles are
// anything with DOMRect's fields.
type Rect = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>

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
    if (r.width > (right - left) * 0.6) {
      // Spans the width: keep whichever side above or below it is taller.
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
