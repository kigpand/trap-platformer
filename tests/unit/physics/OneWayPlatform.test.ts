import { describe, expect, it } from 'vitest';
import { moveWithCollisions } from '../../../src/game/physics/Collision';
import { createPlayer } from '../../../src/game/entities/Player';

// 한쪽 통과 발판(docs/physics-spec.md): 위에서 내려올 때만 막고, 아래·옆에서는 통과한다.
const platform = { x: 100, y: 300, width: 120, height: 12 };
const at = (x: number, feet: number) => { const p = createPlayer(x, 0); p.y = feet - p.height; return p; };

describe('one-way platform collision', () => {
  it('lands a player falling onto it from above', () => {
    const p = at(150, 296);
    p.vy = 600;
    moveWithCollisions(p, [], 0, 10, [platform]);
    expect(p.y + p.height).toBe(300);
    expect(p.grounded).toBe(true);
    expect(p.vy).toBe(0);
  });

  it('keeps a standing player standing (feet exactly on the top)', () => {
    const p = at(150, 300);
    moveWithCollisions(p, [], 0, 0.375, [platform]);
    expect(p.y + p.height).toBe(300);
    expect(p.grounded).toBe(true);
  });

  it('catches a player falling at full speed (15px per step) without passing through', () => {
    const p = at(150, 290);
    moveWithCollisions(p, [], 0, 15, [platform]);
    expect(p.y + p.height).toBe(300);
  });

  it('lets a player jump up through it from below', () => {
    const p = at(150, 320); // 발이 발판 아래, 머리는 발판 높이
    moveWithCollisions(p, [], 0, -10, [platform]);
    expect(p.y + p.height).toBe(310);
    expect(p.grounded).toBe(false);
  });

  it('lets a player walk through its side and does not catch one already below its top', () => {
    const p = at(60, 310); // 몸이 발판 높이에 걸쳐 있다
    moveWithCollisions(p, [], 30, 0, [platform]);
    expect(p.x).toBe(90); // 옆에서 막지 않는다
    moveWithCollisions(p, [], 0, 5, [platform]); // 이미 윗면 아래에 발이 있으면 내려가도 걸리지 않는다
    expect(p.y + p.height).toBe(315);
  });

  it('drops a player who walks off its edge', () => {
    const p = at(225, 300); // 발판 오른쪽 끝(220) 밖
    moveWithCollisions(p, [], 0, 1, [platform]);
    expect(p.grounded).toBe(false);
    expect(p.y + p.height).toBe(301);
  });
});
