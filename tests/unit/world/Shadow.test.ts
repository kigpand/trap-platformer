import { describe, expect, it } from 'vitest';
import { SHADOW_DELAY_STEPS, World } from '../../../src/game/world/World';
import type { Rect } from '../../../src/game/physics/AABB';
import { standAt, testLevel } from './fixtures';

// #22 따라 하는 그림자(docs/traps-spec.md): 트리거한 스텝(0번째)부터 위치를 기록하고, 120번째 스텝부터 120스텝 전 위치를 재생한다.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const left = { horizontal: -1 as const, jumpPressed: false, restartPressed: false };
const trigger: Rect = { x: 400, y: 300, width: 40, height: 200 };
const L = testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }], shadows: [{ trigger, endX: 1200 }] });
function runUntil(world: World, input: typeof idle, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}

describe('#22 mimic shadow', () => {
  it('waits for the trigger', () => {
    const world = new World(L);
    standAt(world, 300);
    runUntil(world, idle, 200);
    expect(world.shadows[0].phase).toBe('idle');
  });

  it('is harmless for steps 0-119 even on the same spot, then kills a player standing still at exactly step 120', () => {
    const world = new World(L);
    standAt(world, 400); // 트리거와 겹친다 — 첫 update가 0번째 스텝
    for (let k = 0; k < SHADOW_DELAY_STEPS; k++) {
      world.update(dt, idle);
      expect(world.deaths, `step ${k}`).toBe(0);
      expect(world.shadows[0].body).toBeNull(); // 흐린 윤곽만 있고 충돌하는 그림자는 없다
    }
    expect(world.shadows[0].origin).toEqual({ x: 400, y: 468 });
    world.update(dt, idle); // 120번째 스텝
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toBe(trigger);
    expect(world.snapshot().deathKind).toBe('shadow');
    expect(world.shadows[0]).toMatchObject({ phase: 'idle', body: null, trail: [] }); // 사망하면 기록이 지워진다
  });

  it('replays exactly where the player was 120 steps earlier', () => {
    const world = new World(L);
    standAt(world, 380);
    const path: { x: number; y: number }[] = [];
    for (let i = 0; i < 200 && world.deaths === 0; i++) {
      world.update(dt, { ...right, jumpPressed: i % 50 === 10 }); // 달리며 가끔 뛴다
      if (world.shadows[0].phase === 'active') path.push({ x: world.player.x, y: world.player.y });
      const k = path.length - 1;
      if (k >= SHADOW_DELAY_STEPS) expect(world.shadows[0].body).toEqual(path[k - SHADOW_DELAY_STEPS]);
    }
    expect(path.length).toBeGreaterThan(SHADOW_DELAY_STEPS + 30);
    expect(world.shadows[0].trail.length).toBeLessThanOrEqual(SHADOW_DELAY_STEPS); // 기록은 120개를 넘게 쌓지 않는다
    expect(world.deaths).toBe(0);
  });

  it('catches a player who turns back', () => {
    const world = new World(L);
    standAt(world, 380);
    runUntil(world, right, 100);
    runUntil(world, left, 300, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.snapshot().deathKind).toBe('shadow');
  });

  it('can be beaten by moving on without stopping, and vanishes past its end x', () => {
    const world = new World(L);
    standAt(world, 380);
    runUntil(world, right, 600, () => world.shadows[0].phase === 'gone');
    expect(world.shadows[0].phase).toBe('gone');
    expect(world.shadows[0].trail).toEqual([]);
    expect(world.deaths).toBe(0);
    runUntil(world, idle, 200); // 사라진 뒤에는 멈춰도 된다
    expect(world.deaths).toBe(0);
  });

  it('is cleared by manual restart', () => {
    const world = new World(L);
    standAt(world, 400);
    runUntil(world, idle, 30);
    world.update(dt, { ...idle, restartPressed: true });
    expect(world.shadows[0]).toMatchObject({ phase: 'idle', steps: 0, origin: null, body: null, trail: [] });
  });
});
