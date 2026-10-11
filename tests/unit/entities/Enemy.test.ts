import { describe, expect, it } from 'vitest';
import { createEnemy, ENEMY_SPEED, updateEnemy } from '../../../src/game/entities/Enemy';

describe('enemy patrol movement', () => {
  it('moves right from the start of the patrol range', () => {
    const e = createEnemy(100, 200, 468);
    updateEnemy(e, 1 / 60);
    expect(e.x).toBeGreaterThan(100);
    expect(e.vx).toBe(ENEMY_SPEED);
  });

  it('reverses direction exactly at the right edge of the patrol range', () => {
    const e = createEnemy(100, 200, 468);
    e.x = 200 - e.width - 1; // one step away from the right edge
    updateEnemy(e, 1 / 60);
    expect(e.x + e.width).toBeLessThanOrEqual(200);
    expect(e.vx).toBeLessThan(0);
  });

  it('reverses direction exactly at the left edge of the patrol range', () => {
    const e = createEnemy(100, 200, 468);
    e.x = 101;
    e.vx = -ENEMY_SPEED;
    updateEnemy(e, 1 / 60);
    expect(e.x).toBeGreaterThanOrEqual(100);
    expect(e.vx).toBeGreaterThan(0);
  });

  it('never leaves the patrol range across many steps', () => {
    const e = createEnemy(100, 200, 468);
    for (let i = 0; i < 600; i++) updateEnemy(e, 1 / 60);
    expect(e.x).toBeGreaterThanOrEqual(100);
    expect(e.x + e.width).toBeLessThanOrEqual(200);
  });
});
