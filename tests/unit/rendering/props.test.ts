// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { CanvasRenderer } from '../../../src/game/rendering/CanvasRenderer';
import { drawGoal, drawSpikes, GOAL_FILL, SPIKE_FILL } from '../../../src/game/rendering/props';
import { World } from '../../../src/game/world/World';
import type { Rect } from '../../../src/game/physics/AABB';
import { testLevel } from '../world/fixtures';
import { drawn, pixels, recorder } from './recorder';

const inside = (map: Map<string, string>, r: Rect): boolean =>
  [...map.keys()].every((k) => { const [x, y] = k.split(',').map(Number); return x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height; });
const everywhere: Rect = { x: -1000, y: -1000, width: 4000, height: 4000 };

function shot(world: World, area: Rect): Map<string, string> {
  const canvas = document.createElement('canvas');
  const { ctx, fills } = recorder();
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);
  world.player.x = 100; world.player.y = 100; // 플레이어 그림이 비교 영역과 겹치지 않게
  new CanvasRenderer(canvas).render(world, { fps: 60, steps: 1 });
  return pixels(fills, area);
}

describe('prop sprites', () => {
  it('draws spikes only inside their hit box, with a full-width base', () => {
    for (const r of [{ x: 400, y: 476, width: 16, height: 24 }, { x: 37, y: 300, width: 40, height: 24 }]) {
      const map = drawn((ctx) => drawSpikes(ctx, r), everywhere);
      expect(inside(map, r)).toBe(true); // 보이는 가시보다 판정이 넓으면 억울하다
      for (let x = r.x; x < r.x + r.width; x++) expect(map.get(`${x},${r.y + r.height - 1}`)).toBe(SPIKE_FILL);
      expect(map.has(`${r.x},${r.y}`)).toBe(false); // 끝이 뾰족하다(위 모서리는 비어 있음)
    }
  });

  it('draws the goal flag inside its 40x60 goal area in both wave frames, and the frames differ', () => {
    const r = { x: 700, y: 440, width: 40, height: 60 };
    const frames = [0, 1].map((wave) => drawn((ctx) => drawGoal(ctx, r, wave), everywhere));
    for (const f of frames) { expect(inside(f, r)).toBe(true); expect([...f.values()]).toContain(GOAL_FILL); }
    expect(frames[1]).not.toEqual(frames[0]); // 나부낀다
  });
});

describe('decoy props look exactly like the real ones', () => {
  // 진짜와 가짜를 같은 자리에 하나씩 둔 두 세계를 그려 그 자리를 비교한다(배경·바닥도 같아진다).
  const ground = [{ x: 0, y: 500, width: 2000, height: 120 }];

  it('a fake clear flag (#14) draws exactly like the goal of the same size', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1234); // 두 그림이 같은 물결 프레임
    const spot = { x: 700, y: 440, width: 40, height: 60 };
    const area = { x: spot.x - 20, y: spot.y - 20, width: spot.width + 40, height: spot.height + 20 };
    const real = shot(new World(testLevel({ goal: spot, solids: ground })), area);
    const fake = shot(new World(testLevel({ goal: { x: 1990, y: 0, width: 10, height: 10 }, fakeGoals: [{ flag: spot, floor: [] }], solids: ground })), area);
    expect(fake).toEqual(real);
    expect([...real.values()]).toContain(GOAL_FILL);
    vi.restoreAllMocks();
  });

  it('a fake checkpoint (#11) draws exactly like an unreached real one, whatever their zone heights', () => {
    const area = { x: 280, y: 400, width: 80, height: 100 };
    const real = shot(new World(testLevel({ checkpoints: [{ zone: { x: 300, y: 340, width: 40, height: 160 }, respawnX: 300, respawnY: 350 }], solids: ground })), area);
    const fake = shot(new World(testLevel({ fakeCheckpoints: [{ x: 300, y: 440, width: 40, height: 60 }], solids: ground })), area);
    expect(fake).toEqual(real);
  });
});
