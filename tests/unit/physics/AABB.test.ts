import { describe, expect, it } from 'vitest';
import { overlaps } from '../../../src/game/physics/AABB';
describe('AABB overlaps', () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  it('detects penetration', () => expect(overlaps(a, { x: 9, y: 9, width: 10, height: 10 })).toBe(true));
  it('does not count touching edges as overlap', () => expect(overlaps(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(false));
});
