import { describe, expect, it } from 'vitest';
import { createPlayer, GRAVITY, MAX_FALL_SPEED } from '../../../src/game/entities/Player';
import { moveWithCollisions } from '../../../src/game/physics/Collision';
const ground = { x: 0, y: 100, width: 200, height: 20 };
describe('collision resolution', () => {
  it('lands on ground from above', () => { const p = createPlayer(10, 55); p.vy = 300; moveWithCollisions(p, [ground], 0, 20); expect(p.y).toBe(68); expect(p.grounded).toBe(true); expect(p.vy).toBe(0); });
  it('stops lateral motion at walls', () => { const p = createPlayer(50, 60); p.vx = 210; moveWithCollisions(p, [{ x: 85, y: 50, width: 15, height: 60 }], 25, 0); expect(p.x).toBe(59); expect(p.vx).toBe(0); });
  it('stops upward motion at ceiling', () => { const p = createPlayer(10, 80); p.vy = -400; moveWithCollisions(p, [{ x: 0, y: 45, width: 100, height: 12 }], 0, -30); expect(p.y).toBe(57); expect(p.vy).toBe(0); });
  it('does not tunnel through the floor on a burst beyond the current max fall speed', () => {
    // ground is 20px thick (the thinnest solid in src/game/world/level.ts); MAX_SUBSTEP (6px)
    // must stay below that for moveWithCollisions to catch the overlap instead of skipping over
    // it in one step. dy=90 is far beyond any single real physics step to lock that margin — see ADR-0002.
    const p = createPlayer(10, 50);
    moveWithCollisions(p, [ground], 0, 90);
    expect(p.y).toBe(68);
    expect(p.grounded).toBe(true);
    expect(p.vy).toBe(0);
  });
  it('rests on floor across repeated steps without sinking', () => {
    const p = createPlayer(10, 68);
    p.grounded = true;
    const dt = 1 / 60;
    for (let i = 0; i < 120; i++) {
      p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY * dt);
      moveWithCollisions(p, [ground], 0, p.vy * dt);
      expect(p.y).toBe(68);
      expect(p.grounded).toBe(true);
      expect(p.vy).toBe(0);
    }
  });
});
