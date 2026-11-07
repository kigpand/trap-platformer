import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { hillColumns, staticSolids, type Hill } from '../../../src/game/world/level';
import { overlaps } from '../../../src/game/physics/AABB';
import { testLevel } from './fixtures';
import { playSolution } from './solution';

// 지형지물(파이프·계단식 언덕): 충돌은 일반 솔리드와 같다(docs/physics-spec.md "충돌 동작 규약").
const ground = { x: 0, y: 500, width: 2000, height: 120 };
const pipe = { x: 400, y: 440, width: 60, height: 60 };
const hill: Hill = { x: 400, y: 500, steps: 3, stepWidth: 60, stepHeight: 40, topWidth: 120 };
const dt = 1 / 60;
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };

describe('hill columns', () => {
  it('splits a hill into touching, non-overlapping columns that stand on its ground', () => {
    const columns = hillColumns(hill);
    expect(columns.map((c) => [c.x, c.width, c.height])).toEqual([
      [400, 60, 40], [460, 60, 80], [520, 120, 120], [640, 60, 80], [700, 60, 40],
    ]);
    for (const c of columns) expect(c.y + c.height).toBe(hill.y);
    for (let i = 1; i < columns.length; i++) expect(columns[i].x).toBe(columns[i - 1].x + columns[i - 1].width);
    for (const a of columns) for (const b of columns) if (a !== b) expect(overlaps(a, b)).toBe(false);
  });

  it('is part of the static terrain together with pipes', () => {
    const level = testLevel({ solids: [ground], pipes: [pipe], hills: [hill] });
    expect(staticSolids(level)).toEqual([ground, pipe, ...hillColumns(hill)]);
    expect(new World(level).terrain).toEqual(staticSolids(level));
  });
});

describe('pipes', () => {
  it('stops a walking player at the pipe side', () => {
    const world = new World(testLevel({ solids: [ground], pipes: [pipe] }));
    for (let i = 0; i < 180; i++) world.update(dt, right);
    expect(world.player.x + world.player.width).toBe(pipe.x);
    expect(world.player.grounded).toBe(true);
  });

  it('can be jumped onto and stood on (real input, no teleporting)', () => {
    const world = new World(testLevel({ solids: [ground], pipes: [pipe] }));
    expect(playSolution(world, [{ run: 380 }, { jump: true }])).toBe(2);
    expect(world.player.y + world.player.height).toBe(pipe.y);
    expect(world.player.x).toBeGreaterThan(pipe.x - world.player.width);
  });
});

describe('stepped hills', () => {
  it('blocks a walker at the first step (no step-up)', () => {
    const world = new World(testLevel({ solids: [ground], hills: [hill] }));
    for (let i = 0; i < 180; i++) world.update(dt, right);
    expect(world.player.x + world.player.width).toBe(hill.x);
  });

  it('is climbed with jumps and crossed down the other side (real input)', () => {
    const world = new World(testLevel({ solids: [ground], hills: [hill] }));
    const top = hill.y - hill.steps * hill.stepHeight;
    const feet = () => world.player.y + world.player.height;
    expect(playSolution(world, [{ run: 390 }, { jump: true }])).toBe(2);
    expect(feet()).toBeLessThan(ground.y); // 한 번 뛰어 단 위에 선다(40px 단이라 두 단 높이까지 닿음)
    expect(playSolution(world, [{ jump: true }])).toBe(1);
    expect(feet()).toBe(top);
    expect(playSolution(world, [{ run: 900 }])).toBe(1); // 내려갈 때는 단마다 떨어져 내린다
    expect(feet()).toBe(ground.y);
  });
});
