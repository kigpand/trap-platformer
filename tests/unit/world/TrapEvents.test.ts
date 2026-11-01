import { describe, expect, it } from 'vitest';
import { World, type TrapEvent } from '../../../src/game/world/World';
import type { Level } from '../../../src/game/world/level';
import type { Rect } from '../../../src/game/physics/AABB';
import { standAt, testLevel } from './fixtures';

// 함정 효과음 이벤트(docs/game-design.md "소리" 표): 발동한 스텝에 위치와 함께 정확히 한 번 나온다.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const flat: Rect = { x: 0, y: 500, width: 2000, height: 120 };

// 입력을 하나씩 넣으며 스텝마다 나온 함정 이벤트를 모은다.
function collect(world: World, inputs: (typeof idle)[]): TrapEvent[][] {
  return inputs.map((input) => { world.update(dt, input); return world.drainTrapEvents(); });
}
const repeat = (input: typeof idle, n: number) => Array.from({ length: n }, () => input);
function firstAt(events: TrapEvent[][]): { step: number; event: TrapEvent } {
  const step = events.findIndex((e) => e.length > 0);
  expect(step, 'an event was emitted').toBeGreaterThanOrEqual(0);
  expect(events.flat()).toHaveLength(1); // 정확히 한 번
  return { step, event: events[step][0] };
}

describe('trap events for sound effects', () => {
  it.each<[string, Partial<Level>, number, (typeof idle)[], TrapEvent['kind'], (w: World) => Rect]>([
    ['spring', { springFloors: [{ tile: { x: 600, y: 500, width: 40, height: 20 }, vx: -600, vy: -800 }] }, 560, repeat(right, 20), 'spring', (w) => w.level.springFloors[0].tile],
    ['spikes (pop-up)', { popUpSpikes: [{ spikes: { x: 700, y: 476, width: 40, height: 24 }, trigger: { x: 600, y: 400, width: 40, height: 100 } }] }, 560, repeat(right, 20), 'spikes', (w) => w.level.popUpSpikes[0].spikes],
    ['gem', { baitGems: [{ x: 620, y: 470 }] }, 560, repeat(right, 30), 'gem', () => ({ x: 620, y: 470, width: 20, height: 20 })],
    ['reverse', { reverseZones: [{ x: 620, y: 300, width: 200, height: 200 }] }, 560, repeat(right, 30), 'reverse', (w) => w.level.reverseZones[0]],
    ['boulder', { boulders: [{ trigger: { x: 700, y: 300, width: 40, height: 200 }, startX: 400, endX: 1900, y: 440 }] }, 650, repeat(right, 20), 'boulder', () => ({ x: 400, y: 440, width: 60, height: 60 })],
    ['vanishing ground (collapse once at start)', { solids: [{ x: 0, y: 500, width: 600, height: 120 }, { x: 1000, y: 500, width: 1000, height: 120 }], vanishingGrounds: [{ x: 600, y: 500, width: 400, height: 120 }] }, 560, repeat(right, 60), 'collapse', (w) => w.level.vanishingGrounds[0]],
  ])('emits %s once, with its area, on the trigger step', (_, parts, x, inputs, kind, rect) => {
    const world = new World(testLevel({ solids: [flat], ...parts }));
    standAt(world, x);
    const { event } = firstAt(collect(world, inputs));
    expect(event.kind).toBe(kind);
    expect(event.rect).toEqual(rect(world));
  });

  it('emits a fling when jumping in a fling zone, and nothing for a normal jump', () => {
    const zone = { x: 600, y: 300, width: 40, height: 200 };
    const world = new World(testLevel({ solids: [flat], flingZones: [{ zone, vx: -420, vy: -720 }] }));
    standAt(world, 300);
    world.update(dt, { ...idle, jumpPressed: true });
    expect(world.drainTrapEvents()).toEqual([]);
    standAt(world, 610);
    world.update(dt, { ...idle, jumpPressed: true });
    expect(world.drainTrapEvents()).toEqual([{ kind: 'fling', rect: zone }]);
  });

  it('emits a collapse when a falling platform, hidden block or third-landing platform gives way, and when the fake floor drops', () => {
    const fp = { x: 600, y: 500, width: 100, height: 20 };
    const a = new World(testLevel({ fallingPlatforms: [fp] }));
    standAt(a, 620);
    expect(firstAt(collect(a, repeat(idle, 13))).event).toEqual({ kind: 'collapse', rect: fp });
    const hb = { x: 600, y: 500, width: 100, height: 120 };
    const b = new World(testLevel({ hiddenBlocks: [hb] }));
    standAt(b, 620);
    expect(firstAt(collect(b, repeat(idle, 7))).event).toEqual({ kind: 'collapse', rect: hb });
    const floor = { x: 500, y: 500, width: 300, height: 120 };
    const c = new World(testLevel({ solids: [{ x: 0, y: 500, width: 500, height: 120 }], fakeGoals: [{ flag: { x: 640, y: 440, width: 40, height: 60 }, floor: [floor] }] }));
    standAt(c, 640);
    c.update(dt, idle);
    c.drainTrapEvents();
    c.collapseFakeFloor();
    expect(c.drainTrapEvents()).toEqual([{ kind: 'collapse', rect: floor }]);
  });

  it('emits a slam when a falling ceiling lands and when a descending ceiling stops', () => {
    const fall = new World(testLevel({ solids: [flat], fallingCeilings: [{ block: { x: 600, y: 380, width: 40, height: 40 }, trigger: { x: 570, y: 380, width: 70, height: 120 } }] }));
    standAt(fall, 545);
    fall.update(dt, right); fall.update(dt, right); // 트리거에 살짝 들어갔다
    const events = collect(fall, repeat({ ...idle, horizontal: -1 }, 30));
    expect(firstAt(events).event).toEqual({ kind: 'slam', rect: { x: 600, y: 460, width: 40, height: 40 } });
    const desc = new World(testLevel({ solids: [flat], descendingCeilings: [{ block: { x: 600, y: 400, width: 100, height: 40 }, trigger: { x: 500, y: 300, width: 40, height: 200 }, speed: 150, floorY: 500 }] }));
    standAt(desc, 500);
    desc.update(dt, idle);
    standAt(desc, 300); // 블록 밑을 비킨다
    expect(firstAt(collect(desc, repeat(idle, 60))).event.kind).toBe('slam');
  });

  it('warns once and then emits the arrow when it appears', () => {
    const world = new World(testLevel({ solids: [flat], arrowTraps: [{ trigger: { x: 400, y: 300, width: 40, height: 200 }, arrows: [{ y: 450, delay: 0, fromX: 1300, toX: 200 }] }] }));
    standAt(world, 410);
    const events = collect(world, repeat(idle, 30)).flat();
    expect(events.map((e) => e.kind)).toEqual(['warning', 'arrow']);
    expect(events[1].rect.x).toBe(1300);
  });

  it('warns for ambushes and sky drops, emits the landing spikes, and the shadow when it becomes solid', () => {
    const amb = new World(testLevel({ solids: [flat], ambushes: [{ trigger: { x: 600, y: 400, width: 40, height: 100 }, minX: 800, maxX: 900, y: 472 }] }));
    standAt(amb, 590);
    expect(firstAt(collect(amb, repeat(idle, 10))).event.kind).toBe('warning');
    const sky = new World(testLevel({ solids: [flat], skyDrops: [{ trigger: { x: 600, y: 400, width: 40, height: 100 }, drops: [{ x: 900, delay: 0, minX: 860, maxX: 980 }] }] }));
    standAt(sky, 590);
    expect(collect(sky, repeat(idle, 5)).flat()).toEqual([{ kind: 'warning', rect: { x: 900, y: 0, width: 28, height: 28 } }]);
    const spikes = new World(testLevel({ solids: [flat], landingSpikeZones: [{ x: 500, y: 300, width: 60, height: 200 }] }));
    standAt(spikes, 510);
    spikes.update(dt, { ...right, jumpPressed: true });
    expect(spikes.drainTrapEvents()).toEqual([{ kind: 'spikes', rect: spikes.landingSpikes[0].spikes }]);
    const shadow = new World(testLevel({ solids: [flat], shadows: [{ trigger: { x: 400, y: 300, width: 40, height: 200 }, endX: 1800 }] }));
    standAt(shadow, 380);
    const { step, event } = firstAt(collect(shadow, repeat(right, 80)));
    expect(event.kind).toBe('shadow');
    expect(step).toBeGreaterThan(40); // 0.7초 뒤 실체가 될 때
  });

  it('emits nothing for rhythm platforms switching on and off', () => {
    const world = new World(testLevel({ solids: [flat], rhythmPlatforms: [{ rect: { x: 600, y: 500, width: 80, height: 20 }, period: 1, onDuration: 0.5, offset: 0 }] }));
    standAt(world, 100);
    expect(collect(world, repeat(idle, 180)).flat()).toEqual([]);
  });
});
