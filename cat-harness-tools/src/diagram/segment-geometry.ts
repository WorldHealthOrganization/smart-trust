/**
 * Two questions about drawn lines, shared by every diagram notation here:
 * does one segment cross another, and does a segment run through a box.
 *
 * Moved out of `archimate/scripts/archimate-crossings.ts` (2026-10-31) so the
 * BPMN readability criteria (`src/workflow/diagram-quality.ts`) count tangles
 * with the same geometry the ArchiMate tools use, instead of a second copy
 * free to disagree.
 *
 * @module cat-harness-tools/src/diagram/segment-geometry
 */

export interface Pt {
  x: number;
  y: number;
}

/** An axis-aligned box, as both ArchiMate views and BPMN DI draw shapes. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How far inside a segment, as a fraction of its length, an intersection must be to count. */
const EPS = 1e-6;
/** A line that only grazes a box's edge by this many px is not through it. */
export const INSET = 2;

/** Where segments p1-p2 and p3-p4 cross strictly inside both, if they do. Touching at an end is not a crossing. */
export function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | undefined {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return undefined;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return undefined;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

/** Where segment a-b passes through the inside of box n (shrunk by `inset`), if it does: the midpoint of the part inside. */
export function segmentThroughBox(a: Pt, b: Pt, n: Box, inset = INSET): Pt | undefined {
  const x0 = n.x + inset, y0 = n.y + inset, x1 = n.x + n.w - inset, y1 = n.y + n.h - inset;
  if (x1 <= x0 || y1 <= y0) return undefined;
  // Liang–Barsky clipping of the segment to the rectangle.
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]] as const) {
    if (p === 0) {
      if (q < 0) return undefined;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return undefined;
  }
  if (t1 - t0 < EPS) return undefined;
  const t = (t0 + t1) / 2;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** The consecutive segments of a polyline. */
export function segmentsOf(pts: readonly Pt[]): Array<readonly [Pt, Pt]> {
  return pts.slice(1).map((p, i) => [pts[i]!, p] as const);
}
