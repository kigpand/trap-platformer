import { describe, expect, it } from 'vitest';
import { createPlayer, MAX_FALL_SPEED, type Player } from '../../../src/game/entities/Player';
import { overlaps, type Rect } from '../../../src/game/physics/AABB';
import { MAX_SUBSTEP, moveWithCollisions } from '../../../src/game/physics/Collision';
import { World, type InputState } from '../../../src/game/world/World';
import { LEVELS } from '../../../src/game/world/level';
import { respawnFrom } from '../world/respawn';

// 무작위(시드 고정) 상황으로 충돌 규약을 확인한다(docs/physics-spec.md "충돌 동작 규약", ADR-0002). 예시 테스트(Collision.test.ts)가
// 고른 경우만 보는 것을 보완한다. 실패하면 메시지의 시드와 번호로 같은 상황을 다시 만들 수 있다.

// mulberry32: 작고 결정적인 의사 난수(새 의존성 없이).
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r: () => number, lo: number, hi: number) => lo + r() * (hi - lo);
const finite = (p: Player) => [p.x, p.y, p.vx, p.vy].every(Number.isFinite);
// 한 고정 스텝의 실제 최대 이동량: 수평은 스프링·날려버리는 점프의 600px/s(10px), 수직은 최대 낙하 900px/s(15px)와
// 날려버리는 점프의 위로 720px/s(12px).
const MAX_DX = 600 / 60;
const MAX_DY = MAX_FALL_SPEED / 60;

describe('collision fuzz (seeded)', () => {
  it('never leaves the player inside a solid, over many random rooms and moves', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed);
      // 솔리드 두께는 ADR-0002 불변식(> MAX_SUBSTEP)을 지킨다.
      const solids: Rect[] = Array.from({ length: 6 + Math.floor(r() * 6) }, () => ({
        x: Math.round(between(r, 0, 600)), y: Math.round(between(r, 0, 600)),
        width: Math.round(between(r, MAX_SUBSTEP + 1, 120)), height: Math.round(between(r, MAX_SUBSTEP + 1, 120)),
      }));
      let p = createPlayer(between(r, 0, 600), between(r, 0, 600));
      for (let tries = 0; solids.some((s) => overlaps(p, s)) && tries < 50; tries++) p = createPlayer(between(r, 0, 600), between(r, 0, 600));
      if (solids.some((s) => overlaps(p, s))) continue; // 빈자리를 못 찾은 방은 건너뛴다
      for (let step = 0; step < 60; step++) {
        const dx = between(r, -MAX_DX, MAX_DX);
        const dy = between(r, -12, MAX_DY);
        moveWithCollisions(p, solids, dx, dy);
        expect(finite(p), `seed ${seed} step ${step}: non-finite`).toBe(true);
        const inside = solids.find((s) => overlaps(p, s));
        expect(inside, `seed ${seed} step ${step}: inside ${JSON.stringify(inside)} at ${p.x},${p.y} after ${dx},${dy}`).toBeUndefined();
      }
    }
  });

  it('never passes through a wall or floor in one move, at any real speed and any thickness above the substep', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const r = rng(seed * 7919);
      const thickness = Math.round(between(r, MAX_SUBSTEP + 1, 40));
      // 벽: 플레이어 높이를 모두 덮는 세로 벽을 바로 앞에 두고 최대 속도까지 민다.
      const wall = { x: 200, y: 0, width: thickness, height: 400 };
      const right = createPlayer(wall.x - 26 - between(r, 0, MAX_DX), 200);
      const dx = between(r, 0, MAX_DX);
      moveWithCollisions(right, [wall], dx, 0);
      expect(right.x + right.width, `seed ${seed}: wall ${thickness}px, dx ${dx}`).toBeLessThanOrEqual(wall.x);
      const left = createPlayer(wall.x + wall.width + between(r, 0, MAX_DX), 200);
      moveWithCollisions(left, [wall], -dx, 0);
      expect(left.x, `seed ${seed}: wall ${thickness}px, dx ${-dx}`).toBeGreaterThanOrEqual(wall.x + wall.width);
      // 바닥: 플레이어 너비를 모두 덮는 바닥 바로 위에서 최대 낙하 속도까지 떨어뜨린다.
      const floor = { x: 0, y: 300, width: 400, height: thickness };
      const fall = createPlayer(100, floor.y - 32 - between(r, 0, MAX_DY));
      const dy = between(r, 0, MAX_DY);
      moveWithCollisions(fall, [floor], 0, dy);
      expect(fall.y + fall.height, `seed ${seed}: floor ${thickness}px, dy ${dy}`).toBeLessThanOrEqual(floor.y);
    }
  });

  it('does not tunnel even on bursts far beyond the real speeds, as long as solids are thicker than the substep (ADR-0002)', () => {
    // 실제 속도(한 스텝 15px 이하)에서는 플레이어가 이동량보다 커 하위 단계 없이도 뚫지 않는다 — 위 테스트는 하위 단계를 지켜 주지 못한다.
    // 하위 단계가 지키는 것은 미래의 고속 이동(대시 등)이므로, 한 번에 수백 px 움직여도 얇은 벽·바닥을 넘지 않는지 따로 확인한다.
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed * 104729);
      const thickness = Math.round(between(r, MAX_SUBSTEP + 1, 20));
      const burst = between(r, 40, 300);
      const wall = { x: 200, y: 0, width: thickness, height: 400 };
      const p = createPlayer(wall.x - 26 - between(r, 0, 20), 200);
      moveWithCollisions(p, [wall], burst, 0);
      expect(p.x + p.width, `seed ${seed}: wall ${thickness}px, dx ${burst}`).toBeLessThanOrEqual(wall.x);
      const floor = { x: 0, y: 300, width: 400, height: thickness };
      const f = createPlayer(100, floor.y - 32 - between(r, 0, 20));
      moveWithCollisions(f, [floor], 0, burst);
      expect(f.y + f.height, `seed ${seed}: floor ${thickness}px, dy ${burst}`).toBeLessThanOrEqual(floor.y);
    }
  });
});

describe('random play on every level (seeded)', () => {
  // 실제 레벨에서 무작위 입력(방향을 잠시 유지, 가끔 점프·재시작)을 넣어도 플레이어가 고정 지형 안에 들어가지 않고
  // 좌표가 유한하며 레벨 안에 있다. 사망·재시작은 정상 흐름이다. 스폰에서만 시작하면 첫 함정들에서 죽어 레벨 앞 1,000px 남짓만
  // 보게 되므로, 스폰과 모든 체크포인트에서 각각 시작한다.
  it('keeps the player out of static terrain and inside the level, from spawn and every checkpoint', () => {
    const dt = 1 / 60;
    for (const [i, level] of LEVELS.entries()) {
      const starts: [string, () => World][] = [['spawn', () => new World(level)], ...level.checkpoints.map((cp, k): [string, () => World] => [`checkpoint ${k + 1}`, () => respawnFrom(level, cp)])];
      for (const [name, make] of starts) {
        const r = rng((i + 1) * 1000 + starts.findIndex(([n]) => n === name));
        const world = make();
        let input: InputState = { horizontal: 1, jumpPressed: false, restartPressed: false };
        let hold = 0;
        for (let step = 0; step < 1200; step++) {
          if (hold-- <= 0) {
            const roll = r();
            input = { horizontal: roll < 0.65 ? 1 : roll < 0.8 ? -1 : 0, jumpPressed: false, restartPressed: false };
            hold = Math.floor(between(r, 5, 60));
          }
          world.update(dt, { ...input, jumpPressed: r() < 0.08, restartPressed: false });
          const p = world.player;
          const where = `level ${i + 1} from ${name}, step ${step} at ${p.x},${p.y}`;
          expect(finite(p), where).toBe(true);
          expect(p.x, where).toBeGreaterThanOrEqual(0);
          expect(p.x + p.width, where).toBeLessThanOrEqual(level.width);
          const inside = world.terrain.find((s) => overlaps(p, s));
          expect(inside, `${where}: inside ${JSON.stringify(inside)}`).toBeUndefined();
        }
      }
    }
  });
});
