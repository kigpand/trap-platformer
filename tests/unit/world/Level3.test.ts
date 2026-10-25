import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { LEVEL_3, LEVELS } from '../../../src/game/world/level';
import { jumpSkyDropHeadOn, playSolution, type Step } from './solution';

// 레벨 3(어려움, 5,600px): 새 함정 8종을 명세 기본 크기로 쉴 틈 없이 이어 붙인다(함정 확장 릴리스 6번).
// 원래 구간이 없어 처음부터 끝까지 해법 입력으로 간다.
const dt = 1 / 60;
const VANISH_SPIKES: Step[] = [{ run: 935 }, { jump: true }]; // 사라지는 땅을 달리다 그대로 가시(트리거 앞 10px 구간)
const INVISIBLE_BLOCK: Step[] = [{ run: 1262 }, { jump: true }]; // 가장자리 46~24px 앞(23px)에서 일찍 뛴다
const SKY_DROPS_1: Step[] = [
  { run: 1454 }, { left: 10 }, // 트리거만 밟고 조금 물러선다(뒤는 투명 블록 구덩이)
  { waitUntil: (w) => w.skyDrops[0].enemies.every((se) => se.phase === 'patrolling') },
  { run: 1540 }, ...jumpSkyDropHeadOn(0, 0), { run: 1780 }, ...jumpSkyDropHeadOn(0, 1),
];
const FAKE_CEILING_SPIKES: Step[] = [
  { run: 2258 }, { jump: true }, // 높이 60px 가짜 체크포인트(출발 구간 12px)
  { run: 2445 }, { right: 4 }, { left: 20 }, { wait: 1 }, { run: 2475 }, { jump: true }, // 천장을 떨어뜨리고 넘는다
  { run: 2634 }, { jump: true }, // 착지하자마자 두 번째 가시
];
const DODGE: Step[] = [{ run: 2898 }, { hop: true }, { wait: 0.3 }, { jump: true }, { run: 3070 }, { jump: true }];
const VANISH_HAZARD: Step[] = [{ run: 3815 }, { jump: true }]; // 두 번째 사라지는 땅 끝(3800) 바로 뒤에서 가짜 안전지대(3840)를 넘는다
const SKY_DROPS_2: Step[] = [
  { run: 4204 }, { left: 10 }, { waitUntil: (w) => w.skyDrops[1].enemies.every((se) => se.phase === 'patrolling') },
  { run: 4340 }, ...jumpSkyDropHeadOn(1, 0), { run: 4580 }, ...jumpSkyDropHeadOn(1, 1),
];
const FINALE: Step[] = [{ run: 4985 }, { jump: true }, { run: 5334 }, { jump: true }, { run: 5560 }]; // 도망가는 목표·구덩이·가시
const FULL: Step[] = [...VANISH_SPIKES, ...INVISIBLE_BLOCK, ...SKY_DROPS_1, ...FAKE_CEILING_SPIKES, ...DODGE, ...VANISH_HAZARD, ...SKY_DROPS_2, ...FINALE];

function respawnAt(index: number): World {
  const cp = LEVEL_3.checkpoints[index];
  const world = new World(LEVEL_3);
  world.activeCheckpoint = { x: cp.respawnX, y: cp.respawnY };
  world.reset(true);
  return world;
}

describe('LEVEL_3 (hard)', () => {
  it('is the last level, the longest, and uses all eight new trap kinds at the spec sizes', () => {
    expect(LEVELS[LEVELS.length - 1]).toBe(LEVEL_3);
    expect(LEVEL_3.width).toBeGreaterThan(Math.max(...LEVELS.slice(0, -1).map((l) => l.width)));
    const kinds = [LEVEL_3.vanishingGrounds, LEVEL_3.invisibleBlocks, LEVEL_3.fallingCeilings, LEVEL_3.dodgingPlatforms,
      LEVEL_3.popUpSpikes, LEVEL_3.fakeCheckpoints, LEVEL_3.goalHops, LEVEL_3.skyDrops];
    expect(kinds.every((list) => list.length > 0)).toBe(true);
    expect(LEVEL_3.popUpSpikes.every((sp) => sp.spikes.width === 40 && sp.spikes.height === 24)).toBe(true);
    expect(LEVEL_3.fakeCheckpoints.every((f) => f.height === 60)).toBe(true);
  });

  it('can be finished from spawn with the solution inputs and no deaths', () => {
    const world = new World(LEVEL_3);
    expect(playSolution(world, FULL)).toBe(FULL.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(0);
    expect(world.goal.rect).toEqual(LEVEL_3.goalHops[LEVEL_3.goalHops.length - 1].to);
  });

  it.each([
    ['checkpoint 1 (before the invisible block)', 0, [{ wait: 0.6 }, ...INVISIBLE_BLOCK, ...SKY_DROPS_1, ...FAKE_CEILING_SPIKES, ...DODGE, ...VANISH_HAZARD, ...SKY_DROPS_2, ...FINALE]],
    ['checkpoint 2 (before the fake checkpoint)', 1, [{ wait: 0.6 }, ...FAKE_CEILING_SPIKES, ...DODGE, ...VANISH_HAZARD, ...SKY_DROPS_2, ...FINALE]],
    ['checkpoint 3 (before the second vanishing ground)', 2, [{ wait: 0.6 }, ...VANISH_HAZARD, ...SKY_DROPS_2, ...FINALE]],
    ['checkpoint 4 (before the second sky drops)', 3, [{ wait: 0.6 }, ...SKY_DROPS_2, ...FINALE]],
  ] as const)('can be finished from %s with no further deaths', (_, index, steps) => {
    const world = respawnAt(index);
    expect(playSolution(world, steps)).toBe(steps.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(1);
  });

  it('gets past the sky drops whatever the timing of arrival', () => {
    // 체크포인트 1에서 출발 전 대기 시간을 바꿔, 쏟아지는 적 구간에 도착하는 시점을 고르게 바꿔 본다.
    for (let delay = 0; delay < 90; delay += 9) {
      const world = respawnAt(0);
      const steps: Step[] = [{ wait: 0.6 + delay / 60 }, ...INVISIBLE_BLOCK, ...SKY_DROPS_1, { run: 2050 }];
      expect(playSolution(world, steps), `waited ${delay} extra steps`).toBe(steps.length);
    }
  });

  it('catches the natural approach at its traps', () => {
    // 투명 블록: 가장자리에서 뛰면 찧고 떨어진다
    const a = respawnAt(0);
    playSolution(a, [{ wait: 0.6 }, { run: 1296 }]);
    a.update(dt, { horizontal: 1, jumpPressed: true, restartPressed: false });
    for (let i = 0; i < 200 && a.deaths === 1; i++) a.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
    expect(a.deathCause?.rect).toBe(LEVEL_3.invisibleBlocks[0]);
    // 쏟아지는 적: 트리거를 밟고 그대로 달리면 맞는다
    const b = respawnAt(3);
    for (let i = 0; i < 400 && b.deaths === 1; i++) b.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
    expect(b.deaths).toBe(2);
    expect(b.deathCause?.rect.x).toBe(LEVEL_3.skyDrops[1].trigger.x);
  });
});
