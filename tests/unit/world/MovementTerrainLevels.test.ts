import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { LEVELS } from '../../../src/game/world/level';
import { overlaps, type Rect } from '../../../src/game/physics/AABB';
import { playSolution, type Step } from './solution';
import { FULL as L1 } from './level1Solution';
import { FULL as L2 } from './level2Solution';
import { FULL as L3 } from './level3Solution';
import { FULL as L4 } from './level4Solution';

// 레벨에 놓인 움직임을 바꾸는 지형지물(트램펄린·컨베이어·진흙)은 해법이 실제로 지나가야 한다 — 해법이 비켜 가면
// 그 지형이 해법·여유 측정에 영향을 주는지 확인되지 않는다.
const solutions: readonly Step[][] = [L1, L2, L3, L4];
const standingOn = (w: World, r: Rect) => w.player.grounded && Math.abs(w.player.y + w.player.height - r.y) < 0.5
  && w.player.x < r.x + r.width && w.player.x + w.player.width > r.x;

describe('movement terrain in the levels', () => {
  it.each(LEVELS.map((level, i) => [i + 1, level] as const))('level %i: the solution steps on every trampoline, belt and mud floor and jumps through every wind zone', (n, level) => {
    const world = new World(level);
    const rects = [...level.trampolines.map((t) => t.tile), ...level.conveyors.map((c) => c.rect), ...level.mudFloors];
    expect(rects.length, `level ${n}`).toBeGreaterThan(0);
    const touched = new Set<Rect>();
    const windsCrossed = new Set<Rect>(); // 바람 구간은 공중에서 지나가야 영향을 받는다
    const original = world.update.bind(world);
    world.update = (step, input) => {
      original(step, input);
      for (const r of rects) if (standingOn(world, r)) touched.add(r);
      for (const w of level.windZones) if (!world.player.grounded && overlaps(world.player, w.zone)) windsCrossed.add(w.zone);
      for (const e of world.drainTrapEvents()) if (e.kind === 'spring') touched.add(e.rect); // 트램펄린은 밟은 스텝에 튕겨 떠 있다
    };
    expect(playSolution(world, solutions[n - 1])).toBe(solutions[n - 1].length);
    expect(world.deaths).toBe(0);
    expect(rects.filter((r) => !touched.has(r)), `level ${n}`).toEqual([]);
    expect(level.windZones.filter((w) => !windsCrossed.has(w.zone)), `level ${n} wind`).toEqual([]);
  });
});

// 바람 구간 아래 구덩이는 "바람 없이는 못 건넘"이어야 한다(Codex 리뷰: 폭 160px이라 가장자리에서 뛰면 바람 없이도 건넜다).
// 바람을 뺀 레벨에서, 구덩이 앞 가장자리 근처(발끝이 25px까지 나간 자리 포함)의 모든 정수 x에서 달리며 뛰어 본다.
describe('wind pits in the levels', () => {
  const run = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
  it.each(LEVELS.flatMap((level, i) => level.windZones.map((w) => [i + 1, level, w.zone] as const)))('level %i: the pit under the wind cannot be crossed by a normal jump', (_, level, zone) => {
    const near = level.solids.filter((s) => s.y === 500 && s.x + s.width > zone.x && s.x + s.width < zone.x + zone.width)
      .reduce((a, b) => (b.x + b.width > a.x + a.width ? b : a));
    const edge = near.x + near.width;
    const calm = { ...level, windZones: [] };
    for (let x = edge - 60; x < edge; x++) {
      const world = new World(calm);
      world.player.x = x; world.player.y = 468; world.player.vy = 0; world.player.grounded = true;
      world.update(1 / 60, { ...run, jumpPressed: true });
      for (let i = 0; i < 180 && world.deaths === 0; i++) world.update(1 / 60, run);
      expect(world.deaths, `jump from x ${x}`).toBe(1);
    }
  });
});
