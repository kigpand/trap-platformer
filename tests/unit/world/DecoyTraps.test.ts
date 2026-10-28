import { describe, expect, it } from 'vitest';
import { gemRect, World } from '../../../src/game/world/World';
import type { Rect } from '../../../src/game/physics/AABB';
import { standAt, testLevel } from './fixtures';

// 미끼 함정(docs/traps-spec.md 20·21번): 가짜 벽과 미끼 보물.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const flat = { x: 0, y: 500, width: 2000, height: 120 };
function runUntil(world: World, input: typeof idle, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}

describe('#20 fake wall', () => {
  // 최대 점프(81.375px)보다 높은 벽 — 넘을 수 없어 보이지만 그대로 걸어 지나간다.
  const wall: Rect = { x: 600, y: 400, width: 40, height: 100 };
  const L = testLevel({ solids: [flat], fakeWalls: [wall] });

  it('is not solid: the player walks straight through', () => {
    const world = new World(L);
    standAt(world, 540);
    runUntil(world, right, 60);
    expect(world.player.x).toBeGreaterThan(wall.x + wall.width);
    expect(world.dynamicSolids()).not.toContainEqual(wall);
  });

  it('turns translucent once overlapped, for that life only', () => {
    // 가짜 안전지대는 바닥이 없는 자리에 일반 바닥처럼 놓는다(그 아래로 빠져 죽는다).
    const world = new World(testLevel({
      solids: [{ x: 0, y: 500, width: 800, height: 120 }, { x: 840, y: 500, width: 1160, height: 120 }], fakeWalls: [wall], hazards: [{ x: 800, y: 500, width: 40, height: 120 }],
    }));
    standAt(world, 540);
    expect(world.fakeWalls[0].revealed).toBe(false);
    runUntil(world, right, 20, () => world.fakeWalls[0].revealed);
    expect(world.fakeWalls[0].revealed).toBe(true);
    runUntil(world, right, 200, () => world.deaths > 0); // 뒤의 가짜 안전지대로 사망
    expect(world.deaths).toBe(1);
    expect(world.fakeWalls[0].revealed).toBe(false); // 다음 목숨에는 다시 진짜처럼
  });

  it('is cleared by manual restart', () => {
    const world = new World(L);
    standAt(world, 590);
    world.update(dt, idle);
    expect(world.fakeWalls[0].revealed).toBe(true);
    world.update(dt, { ...idle, restartPressed: true });
    expect(world.fakeWalls[0].revealed).toBe(false);
  });
});

describe('#21 bait gem', () => {
  it('vanishes on first touch with its non-death taunt, and stays gone for that life', () => {
    const gem = { x: 600, y: 470 };
    const world = new World(testLevel({ solids: [flat], baitGems: [gem] }));
    standAt(world, 540);
    runUntil(world, right, 30, () => world.baitGems[0].taken);
    expect(world.baitGems[0].taken).toBe(true);
    expect(world.taunt?.kind).toBe('baitGemPickup');
    expect(world.deaths).toBe(0);
    expect(world.deathCause).toBeNull();
  });

  it('is blamed for a fall within 3s of taking it', () => {
    // 바닥(0-600) 끝 위, 구덩이 쪽으로 튀어나온 보석. 먹으러 뛰면 구덩이로 떨어진다.
    const gem = { x: 610, y: 440 };
    const world = new World(testLevel({ solids: [{ x: 0, y: 500, width: 600, height: 120 }], baitGems: [gem] }));
    standAt(world, 560);
    world.update(dt, { ...right, jumpPressed: true });
    runUntil(world, right, 200, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toEqual(gemRect(gem));
    expect(world.snapshot().deathKind).toBe('baitGem');
    expect(world.baitGems[0].taken).toBe(false); // 사망하면 다시 나타난다
  });

  it('is not blamed for a fall more than 3s after taking it', () => {
    // 보석(500)에서 구덩이(1300)까지 약 3.8초 걸어간다.
    const gem = { x: 500, y: 470 };
    const world = new World(testLevel({ solids: [{ x: 0, y: 500, width: 1300, height: 120 }], baitGems: [gem] }));
    standAt(world, 450);
    runUntil(world, right, 600, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause).toBeNull();
    expect(world.snapshot().deathKind).toBeNull();
  });

  it('leaves the blame to the trap that actually killed', () => {
    const gem = { x: 500, y: 470 };
    const hazard = { x: 560, y: 500, width: 40, height: 120 };
    const world = new World(testLevel({ solids: [{ x: 0, y: 500, width: 560, height: 120 }, { x: 600, y: 500, width: 1400, height: 120 }], baitGems: [gem], hazards: [hazard] }));
    standAt(world, 450);
    runUntil(world, right, 200, () => world.deaths > 0);
    expect(world.deathCause?.rect).toBe(hazard);
    expect(world.snapshot().deathKind).toBe('hazard');
  });

  it('can be left alone: walking under or past without touching keeps it', () => {
    const gem = { x: 600, y: 380 }; // 머리(468)보다 한참 위
    const world = new World(testLevel({ solids: [flat], baitGems: [gem] }));
    standAt(world, 540);
    runUntil(world, right, 60);
    expect(world.player.x).toBeGreaterThan(gem.x + 20);
    expect(world.baitGems[0].taken).toBe(false);
  });
});
