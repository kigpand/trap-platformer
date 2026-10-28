import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import type { Rect } from '../../../src/game/physics/AABB';
import { standAt, testLevel } from './fixtures';

// #23 착지 예측 가시(docs/traps-spec.md): 구역 안에서 뛰면, 지금 입력을 유지했을 때 떨어질 자리에 가시가 솟는다.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const flat = { x: 0, y: 500, width: 2000, height: 120 };
const zone: Rect = { x: 500, y: 300, width: 60, height: 200 };
const L = testLevel({ solids: [flat], landingSpikeZones: [zone] });
function runUntil(world: World, input: typeof idle, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}
const centerOf = (r: Rect): number => r.x + r.width / 2;

describe('#23 landing spikes', () => {
  it('raises spikes exactly where a held jump lands (checked against the same jump without the trap)', () => {
    const twin = new World(testLevel({ solids: [flat] }));
    standAt(twin, 510);
    twin.update(dt, { ...right, jumpPressed: true });
    runUntil(twin, right, 120, () => twin.player.grounded);
    const landedCenter = centerOf(twin.player);

    const world = new World(L);
    standAt(world, 510);
    world.update(dt, { ...right, jumpPressed: true });
    const spikes = world.landingSpikes[0].spikes;
    expect(spikes).not.toBeNull();
    expect(centerOf(spikes!)).toBeCloseTo(landedCenter, 5);
    expect(spikes!.y + spikes!.height).toBe(flat.y); // 착지면 위
    expect(spikes!.width).toBe(40);
    runUntil(world, right, 120, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toEqual({ x: zone.x, y: zone.y, width: spikes!.x + 40 - zone.x, height: zone.height });
    expect(world.snapshot().deathKind).toBe('landingSpikes');
    expect(world.landingSpikes[0]).toMatchObject({ fired: false, spikes: null }); // 사망하면 처음으로
  });

  it('matches the real landing even when the jump brushes a wall on the way up', () => {
    // 충돌 이동은 벽에 막히면 vx를 0으로 만든다. update는 매 스텝 입력 속도를 다시 넣으므로 예측도 같아야 한다.
    const step = { x: 600, y: 440, width: 40, height: 60 }; // 점프로 넘을 수 있는 낮은 턱
    const geometry = { solids: [flat, step] };
    const twin = new World(testLevel(geometry));
    standAt(twin, 560);
    twin.update(dt, { ...right, jumpPressed: true });
    let bumped = false;
    for (let i = 0; i < 120 && !twin.player.grounded; i++) { twin.update(dt, right); if (twin.player.vx === 0) bumped = true; }
    expect(bumped).toBe(true); // 올라가는 중에 턱 옆면에 닿았다
    const world = new World(testLevel({ ...geometry, landingSpikeZones: [{ x: 540, y: 300, width: 60, height: 200 }] }));
    standAt(world, 560);
    world.update(dt, { ...right, jumpPressed: true });
    expect(centerOf(world.landingSpikes[0].spikes!)).toBeCloseTo(centerOf(twin.player), 5);
  });

  it('can be beaten by letting go mid-air and landing short of the spikes', () => {
    const world = new World(L);
    standAt(world, 510);
    world.update(dt, { ...right, jumpPressed: true });
    runUntil(world, right, 15);
    runUntil(world, idle, 120, () => world.player.grounded);
    expect(world.deaths).toBe(0);
    expect(world.player.x + world.player.width).toBeLessThan(world.landingSpikes[0].spikes!.x);
  });

  it('puts the spikes under a hop in place, harmless until the player rises clear, which steering away in the air escapes', () => {
    // 구현 중 발견: 솟는 순간 플레이어가 가시 위에 있어, 바로 위험하게 하면 발동 스텝에 피할 틈 없이 죽었다.
    const hop = new World(L);
    standAt(hop, 510);
    hop.update(dt, { ...idle, jumpPressed: true });
    expect(hop.deaths).toBe(0);
    expect(centerOf(hop.landingSpikes[0].spikes!)).toBeCloseTo(523, 5);
    runUntil(hop, idle, 120, () => hop.deaths > 0);
    expect(hop.deaths).toBe(1);

    const steer = new World(L);
    standAt(steer, 510);
    steer.update(dt, { ...idle, jumpPressed: true });
    runUntil(steer, right, 120, () => steer.player.grounded);
    expect(steer.deaths).toBe(0);
  });

  it('predicts a landing on a lower surface at that surface', () => {
    const lower = { x: 600, y: 560, width: 1400, height: 60 };
    const world = new World(testLevel({ solids: [{ x: 0, y: 500, width: 600, height: 120 }, lower], landingSpikeZones: [{ x: 540, y: 300, width: 60, height: 200 }] }));
    standAt(world, 570);
    world.update(dt, { ...right, jumpPressed: true });
    const spikes = world.landingSpikes[0].spikes!;
    expect(spikes.y + spikes.height).toBe(lower.y);
    expect(spikes.x).toBeGreaterThan(lower.x);
  });

  it('raises nothing for a trajectory into a pit', () => {
    const world = new World(testLevel({ solids: [{ x: 0, y: 500, width: 600, height: 120 }], landingSpikeZones: [{ x: 540, y: 300, width: 60, height: 200 }] }));
    standAt(world, 570);
    world.update(dt, { ...right, jumpPressed: true });
    expect(world.landingSpikes[0]).toMatchObject({ fired: true, spikes: null });
  });

  it('fires only once per life, and never for a player who walks through', () => {
    const walker = new World(L);
    standAt(walker, 440);
    runUntil(walker, right, 60);
    expect(walker.player.x).toBeGreaterThan(zone.x + zone.width);
    expect(walker.landingSpikes[0].fired).toBe(false);

    const world = new World(L);
    standAt(world, 510);
    world.update(dt, { ...idle, jumpPressed: true });
    runUntil(world, right, 120, () => world.player.grounded); // 공중에서 비켜 안전하게 착지
    const first = world.landingSpikes[0].spikes;
    standAt(world, 540); // 다시 구역 안에서 뛴다
    world.update(dt, { ...right, jumpPressed: true });
    expect(world.landingSpikes[0].spikes).toBe(first);
  });

  it('is cleared by manual restart', () => {
    const world = new World(L);
    standAt(world, 510);
    world.update(dt, { ...right, jumpPressed: true });
    world.update(dt, { ...idle, restartPressed: true });
    expect(world.landingSpikes[0]).toMatchObject({ fired: false, spikes: null });
  });
});
