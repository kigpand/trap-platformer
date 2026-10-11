export interface Rect { x: number; y: number; width: number; height: number }

/** Edges touching does not count as penetration. */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
