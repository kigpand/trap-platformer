import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import type { Rect } from '../../../src/game/physics/AABB';
import { standAt, testLevel } from './fixtures';

// 약올리는 함정 중 강제 비행과 좌우 반전(docs/traps-spec.md 15·16·17번). 함정 하나만 둔 시험용 레벨에서
// 트리거·동작·해법과 강제 비행 종료 시점, 반전 구역 경계의 입력 떨림 여부를 확인한다.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const left = { horizontal: -1 as const, jumpPressed: false, restartPressed: false };
const flat = { x: 0, y: 500, width: 2000, height: 120 };
function runUntil(world: World, input: typeof idle, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}

describe('forced flight (common to #15 and #17)', () => {
  it('does not end on the launch step even when it starts on the ground, but on the first landing after', () => {
    // vy = 0이면 발동한 스텝에 바로 바닥에 닿아 grounded가 된다 — 그래도 그 스텝은 착지로 보지 않는다.
    const tile = { x: 1000, y: 500, width: 40, height: 20 };
    const world = new World(testLevel({ solids: [flat], springFloors: [{ tile, vx: -480, vy: 0 }] }));
    standAt(world, 1000);
    world.update(dt, idle);
    expect(world.player.grounded).toBe(true);
    expect(world.flight).not.toBeNull();
    world.update(dt, idle);
    expect(world.flight).toBeNull();
  });

  it('ignores left/right input for the whole flight and gives it back after landing', () => {
    const tile = { x: 1000, y: 500, width: 40, height: 20 };
    const world = new World(testLevel({ solids: [flat], springFloors: [{ tile, vx: -480, vy: -600 }] }));
    standAt(world, 1000);
    world.update(dt, right); // 발동
    let airSteps = 0;
    while (world.flight && airSteps < 200) {
      const before = world.player.x;
      world.update(dt, right);
      if (world.flight) expect(world.player.x).toBeCloseTo(before - 8, 5); // 오른쪽을 눌러도 vx −480 그대로
      airSteps++;
    }
    expect(world.flight).toBeNull();
    expect(airSteps).toBeGreaterThan(30);
    const landed = world.player.x;
    world.update(dt, right);
    expect(world.player.x).toBeCloseTo(landed + 3.5, 5); // 착지 다음 스텝부터 입력이 먹는다
  });

  it('treats a ceiling bump as not a landing', () => {
    const tile = { x: 1000, y: 500, width: 40, height: 20 };
    const ceiling = { x: 800, y: 400, width: 300, height: 20 }; // 머리(468)에서 48px 위
    const world = new World(testLevel({ solids: [flat, ceiling], springFloors: [{ tile, vx: -480, vy: -600 }] }));
    standAt(world, 1000);
    world.update(dt, idle);
    runUntil(world, idle, 30, () => world.player.y <= ceiling.y + ceiling.height + 0.01);
    expect(world.player.y).toBeCloseTo(ceiling.y + ceiling.height, 5); // 천장에 부딪혔다
    world.update(dt, idle);
    expect(world.flight).not.toBeNull();
    expect(world.flight?.vx).toBe(-480);
    runUntil(world, idle, 200, () => world.flight === null);
    expect(world.player.grounded).toBe(true);
  });

  it('ends on death and on manual restart', () => {
    const tile = { x: 1000, y: 500, width: 40, height: 20 };
    const world = new World(testLevel({ solids: [flat], springFloors: [{ tile, vx: -480, vy: -600 }] }));
    standAt(world, 1000);
    world.update(dt, idle);
    expect(world.flight).not.toBeNull();
    world.update(dt, { ...idle, restartPressed: true });
    expect(world.flight).toBeNull();
    expect(world.springFloors[0].bounced).toBe(false);
  });
});

describe('#15 fling jump', () => {
  // 뒤 바닥(0-400) → 뒤 구덩이(400-900) → 출발 발판(900-1000, 끝 40px가 구역) → 앞 구덩이(1000-1060) → 건너편.
  const zone: Rect = { x: 960, y: 400, width: 40, height: 100 };
  const L = testLevel({
    solids: [{ x: 0, y: 500, width: 400, height: 120 }, { x: 900, y: 500, width: 100, height: 120 }, { x: 1060, y: 500, width: 940, height: 120 }],
    flingZones: [{ zone, vx: -420, vy: -720 }],
  });

  it('flings a player who jumps in the zone backwards into the pit behind; the zone is blamed', () => {
    const world = new World(L);
    standAt(world, 950); // 구역(960-1000)과 겹친다
    world.update(dt, { ...right, jumpPressed: true });
    expect(world.flight?.vx).toBe(-420);
    expect(world.player.vy).toBeCloseTo(-720 + 1350 * dt, 5);
    runUntil(world, right, 300, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toBe(zone);
    expect(world.snapshot().deathKind).toBe('flingJump');
  });

  it('does nothing to a player who walks through the zone', () => {
    const world = new World(testLevel({ solids: [flat], flingZones: [{ zone, vx: -420, vy: -720 }] }));
    standAt(world, 900);
    runUntil(world, right, 60); // 구역을 걸어서 통과
    expect(world.player.x).toBeGreaterThan(zone.x + zone.width);
    expect(world.flight).toBeNull();
  });

  it('jumps normally outside the zone', () => {
    const world = new World(L);
    standAt(world, 920); // 구역 왼쪽 끝(960)보다 앞: 오른쪽 끝 946
    world.update(dt, { ...right, jumpPressed: true });
    expect(world.flight).toBeNull();
    expect(world.player.vy).toBeLessThan(0);
  });

  it('can be beaten by jumping early, from a take-off window of at least 20px', () => {
    // 출발 발판 위 모든 정수 위치에서 뛰어 보고(해법 입력: 점프 + 오른쪽 유지), 건너편에 사망 없이 닿는 위치를 센다.
    const wins: number[] = [];
    for (let x = 875; x < 1000; x++) {
      const world = new World(L);
      standAt(world, x);
      world.update(dt, { ...right, jumpPressed: true });
      runUntil(world, right, 300, () => world.deaths > 0 || world.player.x >= 1200);
      if (world.deaths === 0 && world.player.x >= 1200) wins.push(x);
    }
    expect(wins.length).toBeGreaterThanOrEqual(20);
    expect(wins.every((x, i) => i === 0 || x === wins[i - 1] + 1)).toBe(true); // 한 덩어리 구간
    expect(wins[wins.length - 1] + 26).toBeLessThanOrEqual(zone.x); // 구역에 들어가면 안 된다
  });
});

describe('#16 reverse zone', () => {
  // 바닥(0-300) → 구덩이(300-400) → 건너편(400-). 구역은 건너편 시작(420-660).
  const zone: Rect = { x: 420, y: 300, width: 240, height: 200 };
  const L = testLevel({ solids: [{ x: 0, y: 500, width: 300, height: 120 }, { x: 400, y: 500, width: 1600, height: 120 }], reverseZones: [zone] });

  it('swaps left and right on entry and walks the player back into the pit just crossed; the zone is blamed', () => {
    const world = new World(L);
    standAt(world, 380);
    runUntil(world, right, 20, () => world.reverse !== null);
    expect(world.reverse?.enteredFrom).toBe('left');
    runUntil(world, right, 300, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toBe(zone);
    expect(world.snapshot().deathKind).toBe('reverseZone');
    expect(world.reverse).toBeNull(); // 사망으로 풀린다
  });

  it('stays latched after backing out the entry side, so input does not jitter at the edge', () => {
    const world = new World(L);
    standAt(world, 380);
    runUntil(world, right, 20, () => world.reverse !== null);
    const xs: number[] = [];
    for (let i = 0; i < 20; i++) { world.update(dt, right); xs.push(world.player.x); }
    expect(world.player.x + world.player.width).toBeLessThan(zone.x); // 구역 밖으로 나왔다
    expect(world.reverse).not.toBeNull();
    expect(xs.every((x, i) => i === 0 || x < xs[i - 1])).toBe(true); // 매 스텝 왼쪽으로만 — 떨리지 않는다
  });

  it('reverses in the air too, and leaves jumping alone', () => {
    const world = new World(L);
    standAt(world, 500);
    world.update(dt, idle);
    expect(world.reverse).not.toBeNull();
    world.update(dt, { ...right, jumpPressed: true });
    expect(world.player.vy).toBeLessThan(0);
    world.update(dt, right);
    expect(world.player.grounded).toBe(false);
    expect(world.player.vx).toBe(-210);
  });

  it('can be beaten by pressing the opposite key out of the far side, which releases it', () => {
    const world = new World(L);
    standAt(world, 380);
    runUntil(world, right, 20, () => world.reverse !== null);
    runUntil(world, left, 200, () => world.reverse === null);
    expect(world.reverse).toBeNull();
    expect(world.player.x).toBeGreaterThanOrEqual(zone.x + zone.width);
    runUntil(world, right, 60);
    expect(world.player.x).toBeGreaterThan(zone.x + zone.width + 150); // 다시 오른쪽이 오른쪽
    expect(world.deaths).toBe(0);
  });

  it('latches from the right when entered from the right, and releases on the left side', () => {
    const world = new World(L);
    standAt(world, 700);
    runUntil(world, left, 20, () => world.reverse !== null);
    expect(world.reverse?.enteredFrom).toBe('right');
    runUntil(world, right, 200, () => world.reverse === null); // 반전: 오른쪽 키 = 왼쪽으로
    expect(world.player.x + world.player.width).toBeLessThanOrEqual(zone.x);
  });

  it('is cleared by manual restart', () => {
    const world = new World(L);
    standAt(world, 500);
    world.update(dt, idle);
    world.update(dt, { ...idle, restartPressed: true });
    expect(world.reverse).toBeNull();
  });
});

describe('#17 backward spring floor', () => {
  const tile: Rect = { x: 1000, y: 500, width: 40, height: 20 };
  const L = testLevel({ solids: [flat], springFloors: [{ tile, vx: -480, vy: -600 }] });

  it('bounces a player who walks onto it far back without killing them, and taunts', () => {
    const world = new World(L);
    standAt(world, 900);
    runUntil(world, right, 60, () => world.flight !== null);
    expect(world.springFloors[0].bounced).toBe(true);
    expect(world.taunt?.kind).toBe('springFloor');
    runUntil(world, right, 200, () => world.flight === null);
    expect(world.deaths).toBe(0);
    expect(world.deathCause).toBeNull();
    expect(world.player.x).toBeLessThan(tile.x - 350); // 한참 뒤로 날아갔다
    expect(world.springFloors[0].bounced).toBe(true); // 그 목숨 동안 눌린 모양으로 남는다
  });

  it('can be beaten by jumping over the tile', () => {
    const world = new World(L);
    standAt(world, 940);
    world.update(dt, { ...right, jumpPressed: true });
    runUntil(world, right, 60);
    expect(world.springFloors[0].bounced).toBe(false);
    expect(world.player.x).toBeGreaterThan(tile.x + tile.width);
  });
});
