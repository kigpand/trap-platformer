import { describe, expect, it } from 'vitest';
import { World, type DeathCauseKind } from '../../../src/game/world/World';
import { LEVEL_1, LEVEL_2 } from '../../../src/game/world/level';
import { TAUNTS } from '../../../src/game/rendering/taunts';
import { standAt, testLevel } from './fixtures';

// 놀리는 사망 메시지(docs/game-design.md): 원인 종류가 사망마다 정확히 붙고, 2초 동안만 띄운다.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
function dieUntil(world: World, steps = 240): void {
  const before = world.deaths;
  for (let i = 0; i < steps && world.deaths === before; i++) world.update(dt, idle);
  expect(world.deaths).toBe(before + 1);
}

describe('death cause kinds and taunts', () => {
  it('has a non-empty taunt for every kind in the design table', () => {
    const kinds: DeathCauseKind[] = ['hiddenBlock', 'fallingPlatform', 'ambush', 'hazard', 'conditional', 'enemy', 'vanishingGround',
      'invisibleBlock', 'dodgingPlatform', 'fallingCeiling', 'popUpSpikes', 'fakeCheckpoint', 'fleeingGoal', 'skyDrop', 'flingJump', 'reverseZone', 'fakeClear', 'boulder', 'baitGem', 'landingSpikes', 'shadow'];
    expect(Object.keys(TAUNTS).sort()).toEqual([...kinds, 'springFloor', 'baitGemPickup'].sort());
    expect(TAUNTS.springFloor.length).toBeGreaterThan(0);
    expect(kinds.every((k) => TAUNTS[k].length > 0)).toBe(true);
  });

  it.each([
    ['hazard', (w: World) => { const h = LEVEL_1.hazards[0]; w.player.x = h.x + 1; w.player.y = h.y - w.player.height + 1; }],
    ['enemy', (w: World) => { const e = w.enemies[0]; w.player.x = e.x; w.player.y = e.y; }],
    ['hiddenBlock', (w: World) => { const hb = LEVEL_1.hiddenBlocks[0]; standAt(w, hb.x + 20, hb.y); }],
    ['fallingPlatform', (w: World) => { const fp = LEVEL_1.fallingPlatforms[0]; standAt(w, fp.x + 20, fp.y); }],
    ['vanishingGround', (w: World) => { const vg = LEVEL_1.vanishingGrounds[0]; standAt(w, vg.x + 20, vg.y); }],
  ] as const)('tags a %s death and taunts for 2s', (kind, setup) => {
    const world = new World(LEVEL_1);
    setup(world);
    dieUntil(world);
    expect(world.snapshot().deathKind).toBe(kind);
    expect(world.taunt?.kind).toBe(kind);
    for (let i = 0; i < 119; i++) world.update(dt, idle);
    expect(world.taunt).not.toBeNull(); // 119스텝까지는 남아 있다
    world.update(dt, idle);
    expect(world.taunt).toBeNull(); // 120스텝 = 2초
  });

  // 나머지 사망 경로(코덱스 리뷰: 원인 종류 테스트가 사망 경로 대부분을 검증하지 않았다). 함정 하나만 둔 시험용 레벨에서
  // 실제로 그 함정에 죽게 해, 원인 종류와 놀리는 문구가 맞게 붙는지 확인한다.
  const ground = { x: 0, y: 500, width: 2000, height: 120 };
  const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
  it.each<[DeathCauseKind, () => World, (w: World) => void]>([
    ['ambush', () => new World(testLevel({ solids: [ground], ambushes: [{ trigger: { x: 300, y: 400, width: 40, height: 100 }, minX: 400, maxX: 500, y: 472 }] })),
      (w) => { standAt(w, 310); for (let i = 0; i < 30 && !w.ambushes[0].enemy; i++) w.update(dt, idle); const e = w.ambushes[0].enemy!; w.player.x = e.x; w.player.y = e.y; }],
    ['conditional', () => new World(testLevel({ solids: [ground], conditionalTraps: [{ zone: { x: 300, y: 440, width: 50, height: 80 } }] })),
      (w) => standAt(w, 310)],
    ['invisibleBlock', () => new World(testLevel({ solids: [{ x: 0, y: 500, width: 330, height: 120 }, { x: 470, y: 500, width: 1530, height: 120 }], invisibleBlocks: [{ x: 330, y: 430, width: 80, height: 20 }] })),
      (w) => { standAt(w, 300); w.update(dt, { ...right, jumpPressed: true }); for (let i = 0; i < 30; i++) w.update(dt, right); }], // 가장자리 점프로 블록을 찧고 구덩이로
    ['dodgingPlatform', () => new World(testLevel({ solids: [{ x: 0, y: 500, width: 300, height: 120 }], dodgingPlatforms: [{ platform: { x: 330, y: 480, width: 60, height: 20 }, trigger: { x: 260, y: 380, width: 40, height: 100 }, to: { x: 600, y: 480 } }] })),
      (w) => { standAt(w, 274); w.update(dt, { ...right, jumpPressed: true }); for (let i = 0; i < 14; i++) w.update(dt, right); }], // 원래 발판 쪽으로 뛰다 멈춘다
    ['fallingCeiling', () => new World(testLevel({ solids: [ground], fallingCeilings: [{ block: { x: 600, y: 380, width: 40, height: 40 }, trigger: { x: 560, y: 380, width: 80, height: 120 } }] })),
      (w) => standAt(w, 600)],
    ['popUpSpikes', () => new World(testLevel({ solids: [ground], popUpSpikes: [{ spikes: { x: 400, y: 476, width: 40, height: 24 }, trigger: { x: 340, y: 400, width: 60, height: 100 } }] })),
      (w) => standAt(w, 390)],
    ['fakeCheckpoint', () => new World(testLevel({ solids: [ground], fakeCheckpoints: [{ x: 500, y: 440, width: 40, height: 60 }] })),
      (w) => standAt(w, 500)],
    ['fleeingGoal', () => new World(testLevel({ solids: [{ x: 0, y: 500, width: 1000, height: 120 }, { x: 1100, y: 500, width: 900, height: 120 }], goal: { x: 900, y: 440, width: 40, height: 60 }, goalHops: [{ trigger: { x: 820, y: 400, width: 40, height: 100 }, to: { x: 1200, y: 440, width: 40, height: 60 } }] })),
      (w) => { standAt(w, 830); w.update(dt, idle); standAt(w, 1010); }],
    ['skyDrop', () => new World(testLevel({ solids: [ground], skyDrops: [{ trigger: { x: 400, y: 400, width: 40, height: 100 }, drops: [{ x: 560, delay: 0, minX: 520, maxX: 640 }] }] })),
      (w) => { standAt(w, 410); w.update(dt, idle); standAt(w, 560); }],
  ])('tags a %s death and taunts with its line', (kind, make, setup) => {
    const world = make();
    setup(world);
    dieUntil(world);
    expect(world.snapshot().deathKind).toBe(kind);
    expect(world.taunt?.kind).toBe(kind);
    expect(TAUNTS[world.taunt!.kind]).toBe(TAUNTS[kind]);
  });

  it('does not taunt a plain pit fall with no trap involved', () => {
    const world = new World(LEVEL_2);
    world.player.x = 420; world.player.y = 480; // 레벨 2 구덩이 앞쪽 빈 공간
    dieUntil(world);
    expect(world.snapshot().deathKind).toBeNull();
    expect(world.taunt).toBeNull();
  });

  it('clears the death kind and taunt on manual restart', () => {
    const world = new World(LEVEL_1);
    const h = LEVEL_1.hazards[0]; world.player.x = h.x + 1; world.player.y = h.y - world.player.height + 1;
    dieUntil(world);
    world.update(dt, { ...idle, restartPressed: true });
    expect(world.snapshot().deathKind).toBeNull();
    expect(world.taunt).toBeNull();
  });
});
