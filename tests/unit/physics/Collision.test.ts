import { describe, expect, it } from 'vitest';
import { createPlayer, GRAVITY, MAX_FALL_SPEED, SPEED } from '../../../src/game/entities/Player';
import { moveWithCollisions } from '../../../src/game/physics/Collision';
const ground = { x: 0, y: 100, width: 200, height: 20 };
describe('collision resolution', () => {
  it('lands on ground from above', () => { const p = createPlayer(10, 55); p.vy = 300; moveWithCollisions(p, [ground], 0, 20); expect(p.y).toBe(68); expect(p.grounded).toBe(true); expect(p.vy).toBe(0); });
  it('stops lateral motion at a wall on the right', () => { const p = createPlayer(50, 60); p.vx = 210; moveWithCollisions(p, [{ x: 85, y: 50, width: 15, height: 60 }], 25, 0); expect(p.x).toBe(59); expect(p.vx).toBe(0); });
  it('stops lateral motion at a wall on the left', () => { const p = createPlayer(65, 60); p.vx = -210; moveWithCollisions(p, [{ x: 30, y: 50, width: 15, height: 60 }], -30, 0); expect(p.x).toBe(45); expect(p.vx).toBe(0); });
  it('stops upward motion at ceiling', () => { const p = createPlayer(10, 80); p.vy = -400; moveWithCollisions(p, [{ x: 0, y: 45, width: 100, height: 12 }], 0, -30); expect(p.y).toBe(57); expect(p.vy).toBe(0); });
  it('does not tunnel through the floor on a burst beyond the current max fall speed', () => {
    // ground is 20px thick (the thinnest floor in src/game/world/level.ts — the thinnest wall is 10px,
    // see the next test); MAX_SUBSTEP (6px) must stay below that for moveWithCollisions to catch the
    // overlap instead of skipping over it in one step. dy=90 is far beyond any single real physics step to lock that margin — see ADR-0002.
    const p = createPlayer(10, 50);
    moveWithCollisions(p, [ground], 0, 90);
    expect(p.y).toBe(68);
    expect(p.grounded).toBe(true);
    expect(p.vy).toBe(0);
  });
  it('stops at the thinnest wall (10px) at the fastest horizontal speed (spring, 600px/s)', () => {
    // ADR-0002 재검토: 레벨 2~4의 10px 장애물과 스프링 바닥의 수평 600px/s(한 스텝 10px)가 함께 생겼다.
    // 가장 빠른 수평 속도로 가장 얇은 벽을 밀어도 멈추는지 확인한다(실제 경우 고정). MAX_SUBSTEP 불변식 자체는 고정하지 못한다 —
    // 해소가 이동 방향 기준이라 한 스텝 10px로는 26px 플레이어가 10px 벽을 건너뛸 수 없다(ADR-0002 재검토 기록).
    const wall = { x: 100, y: 0, width: 10, height: 120 };
    const p = createPlayer(40, 60);
    p.vx = 600;
    for (let i = 0; i < 12; i++) moveWithCollisions(p, [wall], 600 / 60, 0);
    expect(p.x).toBe(wall.x - p.width);
    const back = createPlayer(140, 60); // 스프링은 왼쪽으로 날리므로 반대쪽도 확인
    back.vx = -600;
    for (let i = 0; i < 12; i++) moveWithCollisions(back, [wall], -600 / 60, 0);
    expect(back.x).toBe(wall.x + wall.width);
  });
  it('clears grounded when a later substep carries the player past the platform edge', () => {
    // Regression for a Codex-reported bug: landing on an early substep set grounded=true
    // and nothing reset it when a later substep (same frame) moved the player off the
    // platform's edge, leaving a stale grounded=true over open air (and allowing a jump
    // next frame). Repro: player at (518,466), vy=900, moving right for one frame.
    const platform = { x: 0, y: 500, width: 520, height: 120 };
    const p = createPlayer(518, 466);
    p.vy = 900;
    moveWithCollisions(p, [platform], SPEED * (1 / 60), p.vy * (1 / 60));
    expect(p.x).toBeCloseTo(521.5);
    expect(p.y).toBeCloseTo(478);
    expect(p.grounded).toBe(false);
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
