import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import type { Rect } from '../../../src/game/physics/AABB';
import { standAt, testLevel } from './fixtures';

// #14 가짜 클리어(docs/traps-spec.md). 바닥(0-800) → 가짜 깃발이 선 꺼지는 바닥(800-1100, 아래는 구덩이) → 진짜 목표까지 이어진 바닥.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const left = { horizontal: -1 as const, jumpPressed: false, restartPressed: false };
const flag: Rect = { x: 940, y: 440, width: 40, height: 60 };
const floor: Rect = { x: 800, y: 500, width: 300, height: 120 };
const goal: Rect = { x: 1900, y: 440, width: 40, height: 60 };
const L = testLevel({
  solids: [{ x: 0, y: 500, width: 800, height: 120 }, { x: 1100, y: 500, width: 900, height: 120 }],
  goal, fakeGoals: [{ flag, floor: [floor] }],
});
function runUntil(world: World, input: typeof idle, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}
function touchFlag(world: World): void {
  standAt(world, 880);
  world.runTime = 12.34;
  runUntil(world, right, 60, () => world.fakeClear !== null);
  expect(world.fakeClear).not.toBeNull();
}

describe('#14 fake clear', () => {
  it('looks exactly like a clear on touch: cleared in the snapshot, a clear event, and a frozen time, while not really cleared', () => {
    const world = new World(L);
    touchFlag(world);
    expect(world.drainEvents()).toContain('clear');
    expect(world.cleared).toBe(false);
    const snap = world.snapshot();
    expect(snap.cleared).toBe(true);
    const shown = snap.time;
    const run = world.runTime;
    runUntil(world, idle, 60);
    expect(world.snapshot().time).toBe(shown); // 화면에는 멈춘 것처럼
    expect(world.runTime).toBeCloseTo(run + 1, 5); // 실제 런 시간은 계속 흐른다
    expect(world.drainEvents()).not.toContain('clear'); // 닿아 있는 동안 다시 내지 않는다
  });

  it('drops the floor on "next level", and the fall blames the fake flag', () => {
    const world = new World(L);
    touchFlag(world);
    expect(world.collapseFakeFloor()).toBe(true);
    expect(world.snapshot().cleared).toBe(false); // 화면은 바로 평소대로
    expect(world.dynamicSolids()).not.toContainEqual(floor);
    runUntil(world, idle, 200, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toBe(flag);
    expect(world.snapshot().deathKind).toBe('fakeClear');
    expect(world.fakeGoals[0].collapsed).toBe(false); // 사망하면 바닥이 돌아온다
  });

  it('drops the floor wherever the player stands within reach of the flag', () => {
    for (const x of [flag.x - 80 - 25, flag.x + flag.width + 79]) {
      const world = new World(L);
      touchFlag(world);
      standAt(world, x);
      world.update(dt, idle);
      expect(world.fakeClear, `x ${x}`).not.toBeNull(); // 아직 풀리지 않는 거리
      world.collapseFakeFloor();
      runUntil(world, idle, 200, () => world.deaths > 0);
      expect(world.deaths, `x ${x}`).toBe(1);
    }
  });

  it('releases when the player walks more than 80px away from the flag, and keeps going to the real goal', () => {
    const world = new World(L);
    touchFlag(world);
    runUntil(world, right, 120, () => world.fakeClear === null);
    expect(world.player.x).toBeGreaterThan(flag.x + flag.width + 80);
    expect(world.snapshot().cleared).toBe(false);
    expect(world.snapshot().time).toBeGreaterThan(12.34); // 실제 시간으로 돌아온다
    expect(world.collapseFakeFloor()).toBe(false); // 풀린 뒤엔 N을 눌러도 바닥이 그대로
    runUntil(world, right, 600, () => world.cleared);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(0);
  });

  it('releases on the left side too, and triggers again when touched again', () => {
    const world = new World(L);
    touchFlag(world);
    world.drainEvents();
    runUntil(world, left, 120, () => world.fakeClear === null);
    expect(world.player.x + world.player.width).toBeLessThan(flag.x - 80);
    runUntil(world, right, 120, () => world.fakeClear !== null);
    expect(world.fakeClear).not.toBeNull();
    expect(world.drainEvents()).toContain('clear');
  });

  it('does nothing on "next level" outside a fake clear, and is cleared by manual restart', () => {
    const world = new World(L);
    expect(world.collapseFakeFloor()).toBe(false);
    touchFlag(world);
    world.update(dt, { ...idle, restartPressed: true });
    expect(world.fakeClear).toBeNull();
    expect(world.snapshot().cleared).toBe(false);
  });
});
