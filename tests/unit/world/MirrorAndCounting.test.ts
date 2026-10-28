import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import type { MirrorEnemy } from '../../../src/game/world/level';
import type { Rect } from '../../../src/game/physics/AABB';
import { standAt, testLevel } from './fixtures';

// docs/traps-spec.md 29번 따라 뛰는 적, 30번 세 번째 착지에 무너지는 발판.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const flat = { x: 0, y: 500, width: 2000, height: 120 };
function runUntil(world: World, input: typeof idle, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}

describe('#29 mirror-jump enemy', () => {
  // 순찰 600-1100, 높이 472(바닥 위). 적은 600에서 오른쪽으로 120px/s.
  const mirror: MirrorEnemy = { minX: 600, maxX: 1100, y: 472, jumpSpeed: 720 };
  const level = (m: MirrorEnemy = mirror, extra = {}) => testLevel({ solids: [flat], mirrorEnemies: [m], ...extra });
  // 적이 다가와 적 오른쪽 끝과 플레이어 왼쪽 끝 사이가 gap 이하가 되면 제자리에서 뛰고, 그 뒤 서서 기다린다.
  function hopAt(m: MirrorEnemy, gap: number): World {
    const world = new World(level(m));
    standAt(world, 850);
    const e = world.mirrorEnemies[0].enemy;
    runUntil(world, idle, 300, () => world.player.x - (e.x + e.width) <= gap);
    world.update(dt, { ...idle, jumpPressed: true });
    runUntil(world, idle, 150, () => world.deaths > 0);
    return world;
  }

  it('jumps with the player, 720px/s high, keeps patrolling and lands back at its height', () => {
    const world = new World(level());
    standAt(world, 900);
    const m = world.mirrorEnemies[0];
    const x0 = m.enemy.x;
    world.update(dt, { ...idle, jumpPressed: true });
    expect(m.airborne).toBe(true);
    let top = m.enemy.y;
    for (let i = 0; i < 120 && m.airborne; i++) { world.update(dt, idle); top = Math.min(top, m.enemy.y); }
    expect(mirror.y - top).toBeGreaterThan(180); // 최고 약 186px
    expect(m.airborne).toBe(false);
    expect(m.enemy.y).toBe(mirror.y);
    expect(m.enemy.x).toBeGreaterThan(x0 + 100); // 뛰는 동안에도 왕복 이동
  });

  it('ignores jumps more than 400px away and does not re-jump while airborne', () => {
    const far = new World(level());
    standAt(far, 1100); // 적 중심(614)과 1113 — 400px 넘게 떨어짐
    far.update(dt, { ...idle, jumpPressed: true });
    expect(far.mirrorEnemies[0].airborne).toBe(false);

    const world = new World(level());
    standAt(world, 900);
    world.update(dt, { ...idle, jumpPressed: true });
    runUntil(world, idle, 60, () => world.player.grounded);
    const vy = world.mirrorEnemies[0].vy;
    world.update(dt, { ...idle, jumpPressed: true }); // 적은 아직 공중
    expect(world.mirrorEnemies[0].vy).toBeCloseTo(vy + 1350 * dt, 5); // 다시 뛰지 않고 중력만
  });

  it('follows normal, heavy-shoes and fling jumps but not the spring floor', () => {
    const zone = { x: 880, y: 300, width: 60, height: 200 };
    const cases: [string, object, boolean][] = [
      ['normal', {}, true],
      ['heavy', { heavyZones: [{ zone, jumpSpeed: 300 }] }, true],
      ['fling', { flingZones: [{ zone, vx: -420, vy: -720 }] }, true],
      ['spring', { springFloors: [{ tile: { x: 880, y: 500, width: 40, height: 20 }, vx: -480, vy: -600 }] }, false],
    ];
    for (const [name, extra, jumps] of cases) {
      const world = new World(level(mirror, extra));
      standAt(world, 890);
      world.update(dt, name === 'spring' ? idle : { ...idle, jumpPressed: true });
      expect(world.player.grounded, name).toBe(false); // 어떤 식으로든 바닥을 떠났다
      expect(world.mirrorEnemies[0].airborne, name).toBe(jumps);
    }
  });

  it('kills on touch; the patrol and the jump height are blamed', () => {
    const world = new World(level());
    standAt(world, 850);
    runUntil(world, idle, 300, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect.x).toBe(600);
    expect(world.deathCause?.rect.width).toBe(500);
    expect(world.deathCause!.rect.y).toBeLessThan(472 - 180);
    expect(world.snapshot().deathKind).toBe('mirrorEnemy');
  });

  it('can be beaten by hopping in place as it comes: it jumps higher and passes over (14-69px window)', () => {
    const wins: number[] = [];
    for (let gap = 0; gap <= 150; gap++) {
      const world = hopAt(mirror, gap);
      if (world.deaths === 0 && world.mirrorEnemies[0].enemy.x > world.player.x + world.player.width) wins.push(gap);
    }
    expect(wins.length).toBeGreaterThanOrEqual(40);
    expect(wins.every((g, i) => i === 0 || g === wins[i - 1] + 1)).toBe(true);
  });

  it('could not be passed this way if it jumped like the player (-480), which is why the default is -720', () => {
    for (let gap = 0; gap <= 150; gap++) expect(hopAt({ ...mirror, jumpSpeed: 480 }, gap).deaths, `gap ${gap}`).toBe(1);
  });
});

describe('#30 third-landing platform', () => {
  // 바닥(0-300) → 발판(300-600) → 바닥(600-). 발판 아래는 구덩이.
  const rect: Rect = { x: 300, y: 500, width: 300, height: 20 };
  const L = testLevel({ solids: [{ x: 0, y: 500, width: 300, height: 120 }, { x: 600, y: 500, width: 1400, height: 120 }], countingPlatforms: [{ rect, landings: 3 }] });
  function hop(world: World): void {
    world.update(dt, { ...idle, jumpPressed: true });
    runUntil(world, idle, 120, () => world.player.grounded || world.deaths > 0);
  }

  it('counts only landings from the air, not walking onto it', () => {
    const world = new World(L);
    standAt(world, 200);
    runUntil(world, right, 60, () => world.player.x > 400);
    expect(world.countingPlatforms[0].count).toBe(0);
    hop(world);
    expect(world.countingPlatforms[0].count).toBe(1);
  });

  it('vanishes on the third landing with no ground left that step and no jump the next; the platform is blamed', () => {
    const world = new World(L);
    standAt(world, 430);
    hop(world);
    hop(world);
    expect(world.countingPlatforms[0]).toMatchObject({ count: 2, solid: true });
    world.update(dt, { ...idle, jumpPressed: true });
    runUntil(world, idle, 120, () => !world.countingPlatforms[0].solid);
    expect(world.countingPlatforms[0].solid).toBe(false);
    expect(world.player.grounded).toBe(false); // 같은 스텝에 지지를 다시 계산했다(회귀)
    world.update(dt, { ...idle, jumpPressed: true });
    expect(world.player.vy).toBeGreaterThan(0); // 공중이라 점프가 먹지 않는다
    runUntil(world, idle, 200, () => world.deaths > 0);
    expect(world.deathCause?.rect).toBe(rect);
    expect(world.snapshot().deathKind).toBe('countingPlatform');
    expect(world.countingPlatforms[0]).toMatchObject({ count: 0, solid: true }); // 사망하면 처음으로
  });

  it('keeps a player who lands a third time astride solid ground', () => {
    const world = new World(L);
    standAt(world, 590); // 발판 끝(600)과 오른쪽 바닥에 걸쳐 선다
    hop(world); hop(world); hop(world);
    expect(world.countingPlatforms[0].solid).toBe(false);
    expect(world.player.grounded).toBe(true); // 다른 솔리드가 받치고 있으면 그대로 서 있다
    expect(world.deaths).toBe(0);
  });

  it('can be beaten by crossing with two landings or fewer', () => {
    const world = new World(L);
    standAt(world, 270);
    world.update(dt, { ...right, jumpPressed: true });
    runUntil(world, right, 120, () => world.player.grounded);
    world.update(dt, { ...right, jumpPressed: true });
    runUntil(world, right, 120, () => world.player.grounded);
    runUntil(world, right, 120, () => world.player.x > 700);
    expect(world.deaths).toBe(0);
    expect(world.countingPlatforms[0].solid).toBe(true);
  });
});
