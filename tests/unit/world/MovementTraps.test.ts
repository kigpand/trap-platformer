import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import type { Rect } from '../../../src/game/physics/AABB';
import { standAt, testLevel } from './fixtures';

// 이동 규칙을 바꾸는 함정(docs/traps-spec.md 24·28번, docs/physics-spec.md의 함정 예외).
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const left = { horizontal: -1 as const, jumpPressed: false, restartPressed: false };
const flat = { x: 0, y: 500, width: 2000, height: 120 };
function runUntil(world: World, input: typeof idle, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}
function apex(world: World, input: typeof idle): number {
  const start = world.player.y;
  let top = start;
  world.update(dt, { ...input, jumpPressed: true });
  for (let i = 0; i < 120 && !world.player.grounded; i++) { top = Math.min(top, world.player.y); world.update(dt, input); }
  return start - top;
}

describe('#24 heavy shoes zone', () => {
  const zone: Rect = { x: 980, y: 300, width: 20, height: 200 };
  // 바닥(0-1000, 끝 20px가 구역) → 구덩이(1000-1100) → 건너편.
  const L = testLevel({ solids: [{ x: 0, y: 500, width: 1000, height: 120 }, { x: 1100, y: 500, width: 900, height: 120 }], heavyZones: [{ zone, jumpSpeed: 300 }] });

  it('makes jumps inside the zone low (about 33px) and leaves them normal outside', () => {
    const inside = new World(testLevel({ solids: [flat], heavyZones: [{ zone: { x: 400, y: 300, width: 100, height: 200 }, jumpSpeed: 300 }] }));
    standAt(inside, 430);
    expect(apex(inside, idle)).toBeGreaterThan(30);
    standAt(inside, 430);
    expect(apex(inside, idle)).toBeLessThan(35);
    const outside = new World(testLevel({ solids: [flat], heavyZones: [{ zone: { x: 400, y: 300, width: 100, height: 200 }, jumpSpeed: 300 }] }));
    standAt(outside, 600);
    expect(apex(outside, idle)).toBeCloseTo(81.375, 2); // docs/physics-spec.md 최대 점프 높이 그대로
  });

  it('drops a player who jumps the pit from inside the zone; the zone is blamed', () => {
    const world = new World(L);
    standAt(world, 970);
    world.update(dt, { ...right, jumpPressed: true });
    runUntil(world, right, 300, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toBe(zone);
    expect(world.snapshot().deathKind).toBe('heavyShoes');
  });

  it('can be beaten by jumping before the zone, from a take-off window of at least 20px', () => {
    const wins: number[] = [];
    for (let x = 880; x + 26 <= zone.x; x++) {
      const world = new World(L);
      standAt(world, x);
      world.update(dt, { ...right, jumpPressed: true });
      runUntil(world, right, 300, () => world.deaths > 0 || world.player.x >= 1200);
      if (world.deaths === 0) wins.push(x);
    }
    expect(wins.length).toBeGreaterThanOrEqual(20);
    expect(wins.every((x, i) => i === 0 || x === wins[i - 1] + 1)).toBe(true);
  });

  it('shows the heavy mark state only while inside the zone', () => {
    const world = new World(L);
    standAt(world, 900);
    world.update(dt, idle);
    expect(world.heavyShoes).toBe(false);
    standAt(world, 970);
    world.update(dt, idle);
    expect(world.heavyShoes).toBe(true);
  });
});

describe('#28 ice floor', () => {
  const ice: Rect = { x: 400, y: 500, width: 600, height: 20 };
  const L = testLevel({ solids: [flat], iceFloors: [ice] });

  it('keeps sliding about 0.7s and 73px after the key is released', () => {
    const world = new World(L);
    standAt(world, 450);
    world.player.vx = 210;
    runUntil(world, right, 30); // 최고 속도로 달린다
    expect(world.player.vx).toBe(210);
    const from = world.player.x;
    let steps = 0;
    for (; steps < 120 && world.player.vx > 0; steps++) world.update(dt, idle);
    expect(steps).toBe(42); // 210 / 300 = 0.7초
    expect(world.player.x - from).toBeGreaterThan(70);
    expect(world.player.x - from).toBeLessThan(76);
  });

  it('also speeds up gradually from standing, and reverses gradually', () => {
    const world = new World(L);
    standAt(world, 450);
    world.update(dt, right);
    expect(world.player.vx).toBeCloseTo(5, 5);
    runUntil(world, right, 60);
    world.update(dt, left);
    expect(world.player.vx).toBeCloseTo(205, 5);
  });

  it('switches to the instant rules on plain ground and on the jump step and in the air', () => {
    const plain = new World(L);
    standAt(plain, 100);
    plain.update(dt, right);
    expect(plain.player.vx).toBe(210);
    plain.update(dt, idle);
    expect(plain.player.vx).toBe(0);

    const jumper = new World(L);
    standAt(jumper, 450);
    jumper.update(dt, { ...right, jumpPressed: true });
    expect(jumper.player.vx).toBe(210); // 뛰는 스텝은 즉시
    jumper.update(dt, idle);
    expect(jumper.player.vx).toBe(0); // 공중도 즉시
  });

  it('slides a player who stops near the edge into the pit; the ice is blamed', () => {
    const edge = testLevel({ solids: [{ x: 0, y: 500, width: 1000, height: 120 }], iceFloors: [{ x: 600, y: 500, width: 400, height: 20 }] });
    const world = new World(edge);
    standAt(world, 700);
    runUntil(world, right, 200, () => world.player.x + world.player.width >= 960);
    expect(world.player.vx).toBe(210); // 최고 속도로 끝 40px 앞에 왔다
    runUntil(world, idle, 300, () => world.deaths > 0); // 키를 뗐지만 정지 거리(약 73px)가 남은 거리보다 길다
    expect(world.deaths).toBe(1);
    expect(world.snapshot().deathKind).toBe('ice');
  });

  it('can be beaten by letting go early', () => {
    const edge = testLevel({ solids: [{ x: 0, y: 500, width: 1000, height: 120 }], iceFloors: [{ x: 600, y: 500, width: 400, height: 20 }] });
    const world = new World(edge);
    standAt(world, 700);
    runUntil(world, right, 200, () => world.player.x + world.player.width >= 900); // 끝 100px 앞에서 뗀다
    runUntil(world, idle, 120);
    expect(world.deaths).toBe(0);
    expect(world.player.vx).toBe(0);
  });
});
