import { describe, expect, it } from 'vitest';
import { createLifeState, World } from '../../../src/game/world/World';
import { LEVELS } from '../../../src/game/world/level';
import { playSolution } from './solution';
import { FULL as L1 } from './level1Solution';
import { FULL as L2 } from './level2Solution';
import { FULL as L3 } from './level3Solution';
import { FULL as L4 } from './level4Solution';

const solutions = [L1, L2, L3, L4];

// 생성자와 reset()은 목숨마다 상태를 같은 createLifeState로 만든다. 레벨을 한참 진행해 함정 상태를 바꾼 뒤 재시작하면,
// 모든 함정·적 상태가 처음 만든 것과 같아야 한다(하나라도 빠지면 재시작해도 그 함정이 발동한 채로 남는다).
describe('life state', () => {
  it.each(LEVELS.map((level, i) => [i + 1, level] as const))('level %i: restarting restores every trap and enemy state', (n, level) => {
    const world = new World(level);
    const fresh = createLifeState(level);
    const keys = Object.keys(fresh) as (keyof typeof fresh)[];
    const pick = () => Object.fromEntries(keys.map((k) => [k, world[k]]));
    expect(pick()).toEqual(fresh);
    expect(playSolution(world, solutions[n - 1])).toBe(solutions[n - 1].length); // 해법으로 끝까지 가며 함정을 발동시킨다
    expect(world.deaths).toBe(0);
    expect(pick()).not.toEqual(fresh);
    world.reset();
    expect(pick()).toEqual(fresh);
  });
});
