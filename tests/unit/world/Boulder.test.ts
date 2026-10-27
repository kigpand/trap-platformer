import { describe, expect, it } from 'vitest';
import { BOULDER_SIZE, World } from '../../../src/game/world/World';
import type { Rect } from '../../../src/game/physics/AABB';
import { standAt, testLevel } from './fixtures';

// #19 따라오는 돌덩이(docs/traps-spec.md). 평평한 바닥에서 트리거(600-640)에 들어오면 시작 x 380(오른쪽 끝 440 = 트리거 − 160)에
// 나타나 1900까지 굴러간다.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const trigger: Rect = { x: 600, y: 300, width: 40, height: 200 };
const boulder = { trigger, startX: 380, endX: 1900, y: 500 - BOULDER_SIZE };
const L = testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }], boulders: [boulder] });
function runUntil(world: World, input: typeof idle, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}
function enterTrigger(world: World): void {
  standAt(world, 500);
  runUntil(world, right, 60, () => world.boulders[0].phase !== 'idle');
  expect(world.boulders[0].phase).toBe('rolling');
}

describe('#19 rolling boulder', () => {
  it('waits for the trigger, then appears at its start x without moving on that step', () => {
    const world = new World(L);
    standAt(world, 500);
    runUntil(world, idle, 30);
    expect(world.boulders[0].phase).toBe('idle');
    enterTrigger(world);
    expect(world.boulders[0].x).toBe(boulder.startX);
  });

  it('rolls right at 180px/s at a fixed height', () => {
    const world = new World(L);
    enterTrigger(world);
    runUntil(world, right, 60);
    expect(world.boulders[0].x).toBeCloseTo(boulder.startX + 180, 5);
  });

  it('kills a player who stands still in the trigger; the trigger and the path are blamed', () => {
    const world = new World(L);
    enterTrigger(world);
    let steps = 0;
    for (; steps < 300 && world.deaths === 0; steps++) world.update(dt, idle);
    expect(world.deaths).toBe(1);
    expect(steps / 60).toBeGreaterThan(0.7); // 보고 달리기 시작할 시간이 있다
    expect(world.deathCause?.rect).toEqual({ x: 380, y: 300, width: 1520, height: 200 });
    expect(world.snapshot().deathKind).toBe('boulder');
    expect(world.boulders[0].phase).toBe('idle'); // 사망하면 처음 상태로
  });

  it('can be beaten by running without stopping, jumps included, and vanishes at its end x', () => {
    const world = new World(L);
    enterTrigger(world);
    for (let i = 0; i < 600 && world.boulders[0].phase === 'rolling'; i++) {
      world.update(dt, { ...right, jumpPressed: i % 40 === 0 }); // 달리면서 계속 뛴다
    }
    expect(world.deaths).toBe(0);
    expect(world.boulders[0].phase).toBe('gone');
    const edge = world.boulders[0].x + BOULDER_SIZE;
    expect(edge).toBeGreaterThanOrEqual(boulder.endX); // 끝 x에 닿은 스텝에 사라진다(한 스텝 3px 이내로 넘을 수 있음)
    expect(edge).toBeLessThan(boulder.endX + 3);
  });

  it('can still be outrun after standing in the trigger for half a second', () => {
    const world = new World(L);
    enterTrigger(world);
    runUntil(world, idle, 30);
    runUntil(world, right, 600, () => world.boulders[0].phase !== 'rolling' || world.deaths > 0);
    expect(world.deaths).toBe(0);
  });

  it('is reset by manual restart', () => {
    const world = new World(L);
    enterTrigger(world);
    world.update(dt, { ...idle, restartPressed: true });
    expect(world.boulders[0].phase).toBe('idle');
    expect(world.boulders[0].x).toBe(boulder.startX);
  });
});
