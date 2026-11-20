import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { LEVEL_1 } from '../../../src/game/world/level';
import { dt, idle, right, runUntil, testLevel } from './fixtures';

// 이번 런의 사망 표식(docs/game-design.md "기록"): 죽은 자리의 발밑 가운데, 가까운 자리는 합쳐 세고, R로 비운다.
const hazard = LEVEL_1.hazards[0];
const dieOnHazard = (world: World, dx = 1): void => {
  world.player.x = hazard.x + dx;
  world.player.y = hazard.y - world.player.height + 1;
  world.update(dt, idle);
};

describe('death marks', () => {
  it('marks the feet of the player where they died', () => {
    const world = new World(LEVEL_1);
    dieOnHazard(world);
    expect(world.deathMarks).toHaveLength(1);
    const [mark] = world.deathMarks;
    expect(mark.x).toBe(hazard.x + 1 + world.player.width / 2);
    expect(mark.y).toBeCloseTo(hazard.y + 1, 0); // 죽는 스텝에 중력으로 조금 내려간 발밑
    expect(mark.count).toBe(1);
  });

  it('merges deaths at nearly the same spot into one counted mark, and keeps a separate mark further away', () => {
    const world = new World(LEVEL_1);
    dieOnHazard(world, 1);
    dieOnHazard(world, 10);
    expect(world.deathMarks).toHaveLength(1);
    expect(world.deathMarks[0].count).toBe(2);
    dieOnHazard(world, 40);
    expect(world.deathMarks.map((m) => m.count)).toEqual([2, 1]);
  });

  it('puts a pit fall at the height of the ground the player fell from, where they fell', () => {
    const edge = 300;
    const level = testLevel({ solids: [{ x: 0, y: 500, width: edge, height: 120 }, { x: 700, y: 500, width: 1300, height: 120 }] });
    const world = new World(level);
    runUntil(world, right, 600, () => world.runDeaths > 0);
    expect(world.runDeaths).toBe(1);
    expect(world.deathMarks).toHaveLength(1);
    const [mark] = world.deathMarks;
    expect(mark.y).toBe(500);
    expect(mark.x).toBeGreaterThan(edge);
  });

  it('clears the marks on a manual restart (a new run)', () => {
    const world = new World(LEVEL_1);
    dieOnHazard(world);
    world.update(dt, { ...idle, restartPressed: true });
    expect(world.deathMarks).toEqual([]);
  });

  it('adds no marks once the run is cleared, like the run death count', () => {
    const world = new World(LEVEL_1);
    world.player.x = LEVEL_1.goal.x; world.player.y = LEVEL_1.goal.y;
    world.update(dt, idle);
    dieOnHazard(world);
    expect(world.deathMarks).toEqual([]);
  });
});
