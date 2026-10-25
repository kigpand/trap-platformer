import { describe, expect, it } from 'vitest';
import { World, type DeathCauseKind } from '../../../src/game/world/World';
import { LEVEL_1, LEVEL_2 } from '../../../src/game/world/level';
import { TAUNTS } from '../../../src/game/rendering/taunts';
import { standAt } from './fixtures';

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
      'invisibleBlock', 'dodgingPlatform', 'fallingCeiling', 'popUpSpikes', 'fakeCheckpoint', 'fleeingGoal', 'skyDrop'];
    expect(Object.keys(TAUNTS).sort()).toEqual([...kinds].sort());
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
