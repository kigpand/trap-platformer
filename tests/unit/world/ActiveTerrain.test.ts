import { describe, expect, it } from 'vitest';
import { MUD_JUMP_SPEED, MUD_SPEED, World } from '../../../src/game/world/World';
import { standAt, testLevel } from './fixtures';
import { playSolution } from './solution';

// 움직임을 바꾸는 지형지물(함정 아님): 트램펄린·컨베이어 벨트·진흙 바닥. 셋 다 바닥 윗면에 겹쳐 둔다.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const left = { horizontal: -1 as const, jumpPressed: false, restartPressed: false };
const flat = { x: 0, y: 500, width: 2000, height: 120 };
const feet = (w: World) => w.player.y + w.player.height;
function apex(world: World, input = idle): number {
  let top = feet(world);
  for (let i = 0; i < 120; i++) { world.update(dt, input); top = Math.min(top, feet(world)); }
  return 500 - top;
}

describe('trampoline', () => {
  const tile = { x: 400, y: 500, width: 40, height: 20 };
  const L = testLevel({ solids: [flat], trampolines: [{ tile, speed: 720 }] });

  it('bounces a player who walks onto it about 190px high, much higher than a jump', () => {
    const world = new World(L);
    standAt(world, 360);
    for (let i = 0; i < 30 && world.player.vy >= 0; i++) world.update(dt, right);
    expect(world.player.vy).toBe(-720);
    expect(world.player.grounded).toBe(false);
    expect(world.drainTrapEvents().map((e) => e.kind)).toContain('spring');
    expect(apex(world)).toBeGreaterThan(180);
  });

  it('keeps normal air control (unlike the spring trap) and bounces again on landing', () => {
    const world = new World(L);
    standAt(world, 410);
    world.update(dt, idle);
    expect(world.player.vy).toBe(-720);
    world.update(dt, left);
    expect(world.player.vx).toBe(-210); // 공중 좌우 조작은 평소대로
    world.update(dt, right);
    let bounces = 0;
    for (let i = 0; i < 200; i++) { world.update(dt, idle); if (world.player.vy === -720) bounces++; }
    expect(bounces).toBeGreaterThan(0); // 제자리에 떨어지면 다시 튕긴다
  });

  it('carries a player up onto a ledge that a plain jump cannot reach (real input)', () => {
    const ledge = { x: 520, y: 360, width: 300, height: 140 }; // 바닥보다 140px 높음 — 점프(81px)로는 못 오른다
    const world = new World(testLevel({ solids: [flat, ledge], trampolines: [{ tile, speed: 720 }] }));
    expect(playSolution(world, [{ run: 600 }])).toBe(1); // 트램펄린에 올라서 튕긴 채 오른쪽으로
    expect(feet(world)).toBe(ledge.y);
  });
});

describe('conveyor belt', () => {
  const belt = { rect: { x: 300, y: 500, width: 600, height: 20 }, speed: 90 };
  const L = testLevel({ solids: [flat], conveyors: [belt] });

  it('carries a standing player at the belt speed', () => {
    const world = new World(L);
    standAt(world, 400);
    const from = world.player.x;
    for (let i = 0; i < 60; i++) world.update(dt, idle);
    expect(world.player.x - from).toBeCloseTo(90, 0);
  });

  it('adds the belt speed to walking: faster with it, slower against it', () => {
    const withIt = new World(L);
    standAt(withIt, 400);
    withIt.update(dt, right);
    expect(withIt.player.vx).toBe(300);
    const against = new World(L);
    standAt(against, 600);
    against.update(dt, left);
    expect(against.player.vx).toBe(-120);
  });

  it('leaves the jump step and the air to the normal rules', () => {
    const world = new World(L);
    standAt(world, 400);
    world.update(dt, { ...idle, jumpPressed: true });
    expect(world.player.vx).toBe(0);
    world.update(dt, idle);
    expect(world.player.vx).toBe(0);
  });
});

describe('mud floor', () => {
  const mud = { x: 300, y: 500, width: 400, height: 20 };
  const L = testLevel({ solids: [flat], mudFloors: [mud] });

  it('halves walking speed on the mud and restores it off the mud', () => {
    const world = new World(L);
    standAt(world, 400);
    world.update(dt, right);
    expect(world.player.vx).toBe(MUD_SPEED);
    standAt(world, 800);
    world.update(dt, right);
    expect(world.player.vx).toBe(210);
  });

  it('makes jumps from the mud low and short', () => {
    const world = new World(L);
    standAt(world, 400);
    world.update(dt, { ...right, jumpPressed: true });
    expect(world.player.vy).toBeCloseTo(-MUD_JUMP_SPEED + 1350 * dt, 5);
    expect(world.player.vx).toBe(MUD_SPEED); // 뛰는 걸음도 무겁다
    const h = apex(world, right);
    expect(h).toBeGreaterThan(40);
    expect(h).toBeLessThan(55);
  });

  it('can still be crossed by walking (real input)', () => {
    const world = new World(L);
    expect(playSolution(world, [{ run: 900 }])).toBe(1);
    expect(world.deaths).toBe(0);
  });
});
