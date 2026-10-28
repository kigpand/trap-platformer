import { describe, expect, it } from 'vitest';
import { rhythmPhase, World } from '../../../src/game/world/World';
import type { Rect } from '../../../src/game/physics/AABB';
import { standAt, testLevel } from './fixtures';

// 시간에 따라 움직이는 솔리드(docs/traps-spec.md 25·27번).
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const flat = { x: 0, y: 500, width: 2000, height: 120 };
function runUntil(world: World, input: typeof idle, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}

describe('#25 descending ceiling', () => {
  // 통로(600-900) 위 블록의 아랫면 340 — 서 있는 플레이어 머리(468)까지 128px, 60px/s로 약 2.13초.
  const block: Rect = { x: 600, y: 300, width: 300, height: 40 };
  const trigger: Rect = { x: 560, y: 300, width: 40, height: 200 };
  const L = testLevel({ solids: [flat], descendingCeilings: [{ block, trigger, speed: 60, floorY: 500 }] });

  it('waits for the trigger, then descends at 60px/s from the trigger step and stops on the floor', () => {
    const world = new World(L);
    standAt(world, 500);
    runUntil(world, idle, 60);
    expect(world.descendingCeilings[0]).toMatchObject({ phase: 'idle', y: 300 });
    standAt(world, 560);
    runUntil(world, idle, 60);
    expect(world.descendingCeilings[0].y).toBeCloseTo(360, 5);
    standAt(world, 540); // 블록 밖으로 비킨다
    runUntil(world, idle, 300);
    expect(world.descendingCeilings[0]).toMatchObject({ phase: 'stopped', y: 460 }); // 아랫면 = 통로 바닥
    expect(world.dynamicSolids()).toContainEqual({ ...block, y: 460 });
  });

  it('squashes a player who waits under it; the block and trigger are blamed', () => {
    const world = new World(L);
    standAt(world, 590); // 트리거(560-600)와 블록(600-) 둘 다와 겹친다
    let steps = 0;
    for (; steps < 400 && world.deaths === 0; steps++) world.update(dt, idle);
    expect(world.deaths).toBe(1);
    expect(steps / 60).toBeGreaterThan(2); // 머리까지 내려오는 데 약 2.13초
    expect(world.deathCause?.rect).toEqual({ x: 560, y: 300, width: 340, height: 200 });
    expect(world.snapshot().deathKind).toBe('descendingCeiling');
    expect(world.descendingCeilings[0]).toMatchObject({ phase: 'idle', y: 300 });
  });

  it('can be beaten by running through without stopping', () => {
    const world = new World(L);
    standAt(world, 520);
    runUntil(world, right, 200, () => world.player.x > block.x + block.width);
    expect(world.player.x).toBeGreaterThan(block.x + block.width);
    expect(world.deaths).toBe(0);
  });

  it('is solid on the way down: a jump under it bumps its underside', () => {
    const world = new World(L);
    standAt(world, 700);
    world.update(dt, idle);
    expect(world.descendingCeilings[0].phase).toBe('idle'); // 트리거(560-600) 밖
    world.update(dt, { ...idle, jumpPressed: true });
    runUntil(world, idle, 30, () => world.player.vy >= 0);
    expect(world.player.y).toBeGreaterThanOrEqual(block.y + block.height - 0.01);
  });
});

describe('#27 rhythm platforms', () => {
  // 바닥(0-500) → 구덩이 → 박자 발판(560-640) → 구덩이 → 바닥(700-). 2초 주기로 1.2초 나타난다.
  const rect: Rect = { x: 560, y: 500, width: 80, height: 20 };
  const rhythm = { rect, period: 2, onDuration: 1.2, offset: 0 };
  const L = testLevel({ solids: [{ x: 0, y: 500, width: 500, height: 120 }, { x: 700, y: 500, width: 1300, height: 120 }], rhythmPlatforms: [rhythm] });
  const solidNow = (world: World): boolean => world.dynamicSolids().includes(rect);

  it('is solid for onDuration of each period from the start of the life, warning in the last 0.3s', () => {
    expect(rhythmPhase(rhythm, 0.5)).toEqual({ solid: true, warning: false });
    expect(rhythmPhase(rhythm, 1.0)).toEqual({ solid: true, warning: true });
    expect(rhythmPhase(rhythm, 1.5)).toEqual({ solid: false, warning: false });
    expect(rhythmPhase(rhythm, 2.1)).toEqual({ solid: true, warning: false });
    const world = new World(L);
    standAt(world, 100);
    const states: boolean[] = [];
    for (let i = 0; i < 240; i++) { world.update(dt, idle); states.push(solidNow(world)); }
    expect(states.slice(0, 71).every(Boolean)).toBe(true); // 1~71번째 스텝(1.2초 직전까지)
    expect(states.slice(72, 119).some(Boolean)).toBe(false);
    expect(states[120]).toBe(true); // 2초 뒤 다시
  });

  it('drops a player standing on it the step it vanishes, with no jump left that step; the platform is blamed', () => {
    const world = new World(L);
    standAt(world, 580);
    runUntil(world, idle, 200, () => !solidNow(world));
    expect(world.player.grounded).toBe(false); // 같은 스텝에 지지를 다시 계산했다
    world.update(dt, { ...idle, jumpPressed: true });
    expect(world.player.vy).toBeGreaterThan(0); // 공중이라 점프가 먹지 않는다
    runUntil(world, idle, 200, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toBe(rect);
    expect(world.snapshot().deathKind).toBe('rhythmPlatform');
    expect(world.lifeTime).toBe(0); // 다음 목숨은 박자를 처음부터
    expect(solidNow(world)).toBe(true);
  });

  it('is not blamed for a fall it had nothing to do with', () => {
    const world = new World(L);
    standAt(world, 470);
    runUntil(world, idle, 200, () => !solidNow(world)); // 발판이 꺼질 때 플레이어는 땅 위에 있다
    runUntil(world, right, 200, () => world.deaths > 0); // 그 뒤 3초 안에 앞 구덩이로 걸어 들어간다
    expect(world.deaths).toBe(1);
    expect(world.deathCause).toBeNull();
  });

  it('can be beaten by hopping across while it is up', () => {
    const world = new World(L);
    standAt(world, 470);
    world.update(dt, { ...right, jumpPressed: true });
    runUntil(world, right, 120, () => world.player.grounded);
    expect(world.player.x + world.player.width).toBeGreaterThan(rect.x); // 박자 발판 위
    world.update(dt, { ...right, jumpPressed: true });
    runUntil(world, right, 120, () => world.player.x > 800);
    expect(world.deaths).toBe(0);
    expect(world.player.x).toBeGreaterThan(800);
  });
});
