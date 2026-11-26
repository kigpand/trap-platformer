import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../../src/game/world/level';
import { MEDAL_TIMES, medalFor } from '../../../src/game/world/medals';
import { World } from '../../../src/game/world/World';
import { playSolution, type Step } from './solution';
import { FULL as L1 } from './level1Solution';
import { FULL as L2 } from './level2Solution';
import { FULL as L3 } from './level3Solution';
import { FULL as L4 } from './level4Solution';

// 레벨별 목표 기록(medals.ts): 금 = 해법 시간 × 1.15 이내, 은 = × 1.5 이내, 동 = 클리어, 노데스 별은 따로.
describe('level medals', () => {
  it('has targets for every level, gold faster than silver', () => {
    expect(MEDAL_TIMES).toHaveLength(LEVELS.length);
    for (const t of MEDAL_TIMES) expect(t.gold).toBeLessThan(t.silver);
  });

  it('keeps gold reachable by the level solution and not far looser than it', () => {
    // 배치를 바꿔 해법이 느려지면 금을 못 딸 수 있고, 빨라지면 금이 너무 쉬워진다 — 목표를 다시 정하라는 신호.
    const solutions: readonly Step[][] = [L1, L2, L3, L4];
    solutions.forEach((steps, i) => {
      const world = new World(LEVELS[i]);
      playSolution(world, steps);
      const { time } = world.snapshot();
      expect(world.cleared, `level ${i + 1}`).toBe(true);
      expect(time, `level ${i + 1}`).toBeLessThanOrEqual(MEDAL_TIMES[i].gold);
      expect(MEDAL_TIMES[i].gold, `level ${i + 1}`).toBeLessThanOrEqual(Math.ceil(time * 1.2));
      expect(MEDAL_TIMES[i].silver, `level ${i + 1}`).toBe(Math.ceil(time * 1.5));
    });
  }, 60_000);

  it('picks the tier by time, inclusive of the target, and adds the star only without deaths', () => {
    expect(medalFor(0, { time: 72, deaths: 0 })).toEqual({ tier: 'gold', flawless: true });
    expect(medalFor(0, { time: 72.1, deaths: 2 })).toEqual({ tier: 'silver', flawless: false });
    expect(medalFor(0, { time: 94, deaths: 1 })).toEqual({ tier: 'silver', flawless: false });
    expect(medalFor(0, { time: 94.1, deaths: 0 })).toEqual({ tier: 'bronze', flawless: true });
    expect(medalFor(99, { time: 1, deaths: 0 })).toEqual({ tier: 'bronze', flawless: true }); // 목표 없는 레벨
  });
});
