import { describe, expect, it } from 'vitest';
import { ARROW_WARNING, World } from '../../../src/game/world/World';
import type { Arrow } from '../../../src/game/world/level';
import type { Rect } from '../../../src/game/physics/AABB';
import { standAt, testLevel } from './fixtures';

// #26 화살 발사대(docs/traps-spec.md). 평평한 바닥, 트리거(400-440). 화살은 오른쪽 화면 밖(1300)에서 왼쪽으로 날아온다.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const trigger: Rect = { x: 400, y: 300, width: 40, height: 200 };
const low: Arrow = { y: 484, delay: 0, fromX: 1300, toX: 200 }; // 바닥 위 10~16px — 서 있으면 맞고 뛰면 넘는다
const high: Arrow = { y: 450, delay: 0, fromX: 1300, toX: 200 }; // 아랫면 456 — 서 있는 머리(468) 위로 지나간다
const level = (arrows: Arrow[]) => testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }], arrowTraps: [{ trigger, arrows }] });
function runUntil(world: World, input: typeof idle, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}

describe('#26 arrow launcher', () => {
  it('warns from its delay, appears at fromX 0.4s later, flies 6px a step and vanishes at toX', () => {
    const world = new World(level([{ ...low, delay: 0.5, toX: 1000 }]));
    standAt(world, 300);
    runUntil(world, idle, 60);
    expect(world.arrowTraps[0].elapsed).toBeNull();
    standAt(world, 410);
    const a = world.arrowTraps[0].arrows[0];
    runUntil(world, idle, 29);
    expect(a.phase).toBe('idle');
    world.update(dt, idle); // 30번째 스텝 = 0.5초
    expect(a.phase).toBe('warning');
    runUntil(world, idle, Math.round(ARROW_WARNING * 60));
    expect(a).toMatchObject({ phase: 'flying', x: 1300 }); // 나타난 스텝은 움직이지 않는다
    world.update(dt, idle);
    expect(a.x).toBeCloseTo(1294, 5);
    runUntil(world, idle, 100, () => a.phase === 'gone');
    expect(a.phase).toBe('gone');
    expect(a.x).toBeLessThanOrEqual(1000 + 1e-6);
  });

  it('kills a player standing in the path of a low arrow; the trigger and the path are blamed', () => {
    const world = new World(level([low]));
    standAt(world, 410);
    runUntil(world, idle, 600, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toEqual({ x: 200, y: 300, width: 1130, height: 200 });
    expect(world.snapshot().deathKind).toBe('arrow');
    expect(world.arrowTraps[0]).toMatchObject({ elapsed: null });
  });

  it('never skips over the player, whatever the per-step phase of the arrow', () => {
    // 한 스텝 6px이라 0~5px만 바꿔도 모든 경우지만, 속도를 올렸을 때(한 스텝이 폭 합 56px을 넘으면 건너뛸 수 있음)도
    // 잡히도록 60px까지 바꿔 본다 — 어느 경우든 서 있는 플레이어를 반드시 맞혀야 한다.
    for (let k = 0; k < 60; k++) {
      const world = new World(level([{ ...low, fromX: 1300 + k }]));
      standAt(world, 410);
      runUntil(world, idle, 600, () => world.deaths > 0);
      expect(world.deaths, `offset ${k}`).toBe(1);
    }
  });

  it('can be beaten by jumping a low arrow', () => {
    const world = new World(level([low]));
    standAt(world, 410);
    const a = world.arrowTraps[0].arrows[0];
    runUntil(world, idle, 600, () => a.phase === 'flying' && a.x <= world.player.x + world.player.width + 40);
    world.update(dt, { ...idle, jumpPressed: true });
    runUntil(world, idle, 300, () => a.phase === 'gone' || world.deaths > 0);
    expect(world.deaths).toBe(0);
    expect(a.phase).toBe('gone');
  });

  it('lets a high arrow pass over a standing player but hits one who jumps into it', () => {
    const stand = new World(level([high]));
    standAt(stand, 410);
    runUntil(stand, idle, 600, () => stand.arrowTraps[0].arrows[0].phase === 'gone' || stand.deaths > 0);
    expect(stand.deaths).toBe(0);

    const jump = new World(level([high]));
    standAt(jump, 410);
    const a = jump.arrowTraps[0].arrows[0];
    runUntil(jump, idle, 600, () => a.phase === 'flying' && a.x <= jump.player.x + jump.player.width + 40);
    jump.update(dt, { ...idle, jumpPressed: true });
    runUntil(jump, idle, 300, () => a.phase === 'gone' || jump.deaths > 0);
    expect(jump.deaths).toBe(1);
  });

  it('fires once per life and is cleared by manual restart', () => {
    const world = new World(level([{ ...low, toX: 1200 }]));
    standAt(world, 410);
    runUntil(world, idle, 300, () => world.arrowTraps[0].arrows[0].phase === 'gone');
    runUntil(world, idle, 60);
    expect(world.arrowTraps[0].arrows[0].phase).toBe('gone'); // 트리거에 서 있어도 다시 쏘지 않는다
    world.update(dt, { ...idle, restartPressed: true });
    expect(world.arrowTraps[0]).toMatchObject({ elapsed: null });
    expect(world.arrowTraps[0].arrows[0].phase).toBe('idle');
  });
});
