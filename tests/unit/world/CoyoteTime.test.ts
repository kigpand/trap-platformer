import { describe, expect, it } from 'vitest';
import type { Level } from '../../../src/game/world/level';
import { MUD_JUMP_SPEED, World, type InputState } from '../../../src/game/world/World';
import { JUMP_SPEED } from '../../../src/game/entities/Player';
import { dt, idle, right, runUntil, standAt, testLevel } from './fixtures';

// 코요테 타임(docs/physics-spec.md "코요테 타임"): 스스로 움직여 바닥을 벗어난 뒤 6스텝 동안은 공중이어도 점프할 수 있다.
// 명세 값을 그대로 적는다 — 상수를 가져와 쓰면 상수를 바꿔도 테스트가 따라 바뀌어 잡지 못한다.
const COYOTE = 6;
const jumpRight: InputState = { ...right, jumpPressed: true };
// 왼쪽 땅(가장자리 x 600)과 넓은 구덩이. 땅 윗면 500.
const ledge = { x: 0, y: 500, width: 600, height: 120 };
const EDGE = 600;

// 가장자리를 향해 달리다 처음으로 공중이 된 스텝 뒤, airSteps번째 공중 스텝(0부터)에 점프를 누른다. 누른 스텝에 뛰었는지 돌려준다.
function jumpAfterLeaving(world: World, airSteps: number): boolean {
  for (let i = 0; i < 400 && world.player.grounded; i++) world.update(dt, right);
  runUntil(world, right, airSteps);
  const vyBefore = world.player.vy;
  world.update(dt, jumpRight);
  return world.player.vy < 0 && vyBefore >= 0;
}

function worldNearEdge(parts: Partial<Level> = {}): World {
  const world = new World(testLevel({ solids: [ledge], ...parts }));
  standAt(world, EDGE - 60);
  return world;
}

describe('코요테 타임', () => {
  it('가장자리를 걸어서 벗어난 뒤 6스텝 동안은 공중에서도 뛴다', () => {
    for (let k = 0; k < COYOTE; k++) {
      const world = worldNearEdge();
      expect(jumpAfterLeaving(world, k), `air step ${k}`).toBe(true);
      expect(world.player.vy).toBeCloseTo(-JUMP_SPEED + 1350 * dt, 5);
      expect(world.drainEvents()).toContain('jump');
    }
  });

  it('그 뒤에는 뛰지 않는다', () => {
    expect(jumpAfterLeaving(worldNearEdge(), COYOTE)).toBe(false);
    expect(jumpAfterLeaving(worldNearEdge(), COYOTE + 10)).toBe(false);
  });

  it('점프로 떠오른 뒤에는 공중에서 한 번 더 뛰지 못한다(이단 점프 없음)', () => {
    const world = worldNearEdge();
    world.update(dt, idle); // 바닥에 서서 끝난 스텝 — 코요테 타임이 채워진 상태에서 뛴다
    world.update(dt, { ...idle, jumpPressed: true });
    expect(world.player.grounded).toBe(false);
    expect(world.drainEvents()).toEqual(['jump']);
    for (let k = 0; k < COYOTE + 2; k++) world.update(dt, { ...idle, jumpPressed: true });
    expect(world.drainEvents()).toEqual([]);
  });

  it('발밑이 사라진 것(낙하 발판)은 코요테 타임을 주지 않는다', () => {
    const platform = { x: 300, y: 500, width: 150, height: 20 };
    const world = new World(testLevel({ solids: [], fallingPlatforms: [platform] }));
    standAt(world, 350);
    for (let i = 0; i < 60 && world.player.grounded; i++) world.update(dt, idle);
    expect(world.player.grounded).toBe(false); // 무너져 떨어지기 시작
    world.update(dt, { ...idle, jumpPressed: true });
    expect(world.player.vy).toBeGreaterThan(0);
    expect(world.drainEvents()).not.toContain('jump');
  });

  it('트램펄린에 튕긴 뒤에는 코요테 타임을 주지 않는다', () => {
    const tile = { x: 400, y: 500, width: 40, height: 20 };
    const world = new World(testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }], trampolines: [{ tile, speed: 720 }] }));
    standAt(world, 300);
    for (let i = 0; i < 120 && world.player.vy >= 0; i++) world.update(dt, right);
    expect(world.player.vy).toBeLessThan(0); // 튕겨 오름
    world.drainEvents();
    for (let k = 0; k < COYOTE + 2; k++) world.update(dt, { ...right, jumpPressed: true });
    expect(world.drainEvents()).not.toContain('jump');
  });

  it('사망·재시작하면 코요테 타임을 비운다', () => {
    const world = worldNearEdge();
    for (let i = 0; i < 400 && world.player.grounded; i++) world.update(dt, right);
    world.reset(true); // 스폰(공중 350)에서 떨어지며 시작
    world.update(dt, { ...idle, jumpPressed: true });
    expect(world.player.vy).toBeGreaterThan(0);
  });

  describe('코요테 점프는 마지막으로 서 있던 자리에서 뛴 것으로 본다', () => {
    const atEdge = { x: EDGE - 20, y: 300, width: 20, height: 200 };

    it('가장자리의 날려버리는 점프 구역(#15)을 지나친 뒤 뛰어도 날아간다', () => {
      const world = worldNearEdge({ flingZones: [{ zone: atEdge, vx: -420, vy: -720 }] });
      for (let i = 0; i < 400 && world.player.grounded; i++) world.update(dt, right);
      runUntil(world, right, COYOTE - 1);
      expect(world.player.x).toBeGreaterThanOrEqual(atEdge.x + atEdge.width); // 이미 구역 밖
      world.update(dt, jumpRight);
      expect(world.flight).not.toBeNull();
    });

    it('무거운 신발 구역(#24)도 마지막 자리로 판정해 낮게 뛴다', () => {
      const world = worldNearEdge({ heavyZones: [{ zone: atEdge, jumpSpeed: 300 }] });
      expect(jumpAfterLeaving(world, COYOTE - 1)).toBe(true);
      expect(world.player.vy).toBeCloseTo(-300 + 1350 * dt, 5);
    });

    it('진흙에서 걸어 떨어진 뒤 뛰면 진흙 점프다', () => {
      const world = worldNearEdge({ mudFloors: [{ x: EDGE - 100, y: 500, width: 100, height: 20 }] });
      expect(jumpAfterLeaving(world, 2)).toBe(true);
      expect(world.player.vy).toBeCloseTo(-MUD_JUMP_SPEED + 1350 * dt, 5);
    });
  });
});
