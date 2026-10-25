import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { LEVEL_1 } from '../../../src/game/world/level';
import { playSolution, type Step } from './solution';

// 레벨 1(쉬움): 원래 구간(숨겨진 블록·적·가짜 안전지대·낙하 발판·갑자기 출현하는 적·조건부 함정) 뒤에
// 새 함정 4종을 하나씩 소개한다 — 사라지는 땅 → 떨어지는 천장 → 솟아오르는 가시(좁은 16px) → 도망가는 발판.
// 함정 확장 릴리스 5번(docs/roadmap.md)의 완료 기준: 해법 입력으로 스폰과 모든 체크포인트에서 사망 없이 목표까지.
const [cp1, cp2, cp3] = LEVEL_1.checkpoints;
const ceiling = LEVEL_1.fallingCeilings[0];
const spikes = LEVEL_1.popUpSpikes[0];
const dodge = LEVEL_1.dodgingPlatforms[0];

// 구간별 해법. 원래 구간은 보이는 것만 피하면 되므로 자동 플레이로 간다.
const ORIGINAL: Step[] = [{ auto: 1940 }];
const VANISHING_AND_CEILING: Step[] = [
  { run: ceiling.trigger.x - 10 }, // 사라지는 땅은 멈추지 않고 달려 지나간다
  { right: 4 }, { left: 20 }, { wait: 1 }, // 천장 트리거에 살짝 들어갔다 물러서서 떨어뜨린다
  { run: ceiling.block.x - 25 }, { jump: true }, // 떨어진 블록(높이 40)을 넘는다
];
const SPIKES: Step[] = [{ run: spikes.trigger.x - 35 }, { jump: true }]; // 가시가 솟기 전에 트리거·가시를 함께 넘는다
const DODGE_AND_GOAL: Step[] = [
  { run: dodge.trigger.x + dodge.trigger.width - 2 }, { hop: true }, { wait: 0.3 }, // 제자리 점프로 발판을 먼저 도망가게 한다
  { jump: true }, // 옮겨 간 발판(3120-3180)으로
  { run: dodge.to.x + dodge.platform.width - 10 }, { jump: true }, // 건너편 ground5로
  { run: LEVEL_1.goal.x + 20 },
];
const FULL = [...ORIGINAL, ...VANISHING_AND_CEILING, ...SPIKES, ...DODGE_AND_GOAL];

function respawnAt(cp: typeof cp1): World {
  const world = new World(LEVEL_1);
  world.activeCheckpoint = { x: cp.respawnX, y: cp.respawnY };
  world.reset(true); // 게임의 사망 재시작 경로로 체크포인트에서 시작한다
  return world;
}

describe('LEVEL_1 (easy, extended)', () => {
  it('is much longer than before and introduces four new trap kinds', () => {
    expect(LEVEL_1.width).toBeGreaterThanOrEqual(4000);
    expect(LEVEL_1.vanishingGrounds.length + LEVEL_1.fallingCeilings.length + LEVEL_1.popUpSpikes.length + LEVEL_1.dodgingPlatforms.length).toBe(4);
  });

  it('can be finished from spawn with the solution inputs and no deaths', () => {
    const world = new World(LEVEL_1);
    expect(playSolution(world, FULL)).toBe(FULL.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(0);
  });

  it.each([
    ['checkpoint 1 (before the hazard)', cp1, FULL],
    ['checkpoint 2 (before the vanishing ground)', cp2, [{ run: 1950 }, ...VANISHING_AND_CEILING, ...SPIKES, ...DODGE_AND_GOAL]],
    ['checkpoint 3 (before the dodging platform)', cp3, DODGE_AND_GOAL],
  ] as const)('can be finished from %s with no further deaths', (_, cp, steps) => {
    const world = respawnAt(cp);
    expect(playSolution(world, steps)).toBe(steps.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(1); // 체크포인트로 보내려고 일부러 낸 사망 1회뿐
  });

  it('catches a player who just holds right through the new traps (each is a real trap)', () => {
    // 떨어지는 천장: 체크포인트 2에서 →만 누르면 사라지는 땅은 지나지만 천장에 깔린다
    const a = respawnAt(cp2);
    for (let i = 0; i < 600 && a.deaths === 1; i++) a.update(1 / 60, { horizontal: 1, jumpPressed: false, restartPressed: false });
    expect(a.deathCause?.rect).toBe(ceiling.block);
    // 도망가는 발판: 체크포인트 3에서 원래 발판으로 뛰면 발판이 도망간다
    const b = respawnAt(cp3);
    playSolution(b, [{ run: dodge.trigger.x + dodge.trigger.width - 2 }, { right: 1 }]);
    b.update(1 / 60, { horizontal: 1, jumpPressed: true, restartPressed: false });
    for (let i = 0; i < 14; i++) b.update(1 / 60, { horizontal: 1, jumpPressed: false, restartPressed: false });
    for (let i = 0; i < 200 && b.deaths === 1; i++) b.update(1 / 60, { horizontal: 0, jumpPressed: false, restartPressed: false });
    expect(b.deathCause?.rect).toBe(dodge.platform);
  });
});
