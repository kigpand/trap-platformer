// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { CanvasRenderer, VIEW_HEIGHT } from '../../../src/game/rendering/CanvasRenderer';
import { drawBlock, drawGround, GROUND_FILL } from '../../../src/game/rendering/terrain';
import { World } from '../../../src/game/world/World';
import type { Rect } from '../../../src/game/physics/AABB';
import { testLevel } from '../world/fixtures';
import { drawn, pixels, recorder, relative } from './recorder';

const view = { x: 0, width: 960, height: VIEW_HEIGHT };

describe('terrain textures', () => {
  it('tiles seamlessly: a ground split into pieces looks exactly like one long ground', () => {
    // 사라지는 땅(40px 칸)·가짜 안전지대처럼 바닥을 잘라 그려도 이음매가 보이면 안 된다.
    const whole: Rect = { x: 200, y: 500, width: 200, height: 40 };
    const one = drawn((ctx) => drawGround(ctx, whole, view), whole);
    const split = drawn((ctx) => { for (let x = 200; x < 400; x += 40) drawGround(ctx, { ...whole, x, width: 40 }, view); }, whole);
    expect(split).toEqual(one);
    expect(new Set(one.values()).size).toBeGreaterThan(2); // 단색 두 줄이 아니라 무늬가 있다
  });

  it('moves the pattern with a sliding ground instead of letting it slide across it', () => {
    const rest: Rect = { x: 300, y: 400, width: 80, height: 20 };
    const moved: Rect = { x: 350, y: 380, width: 80, height: 20 };
    const before = drawn((ctx) => drawGround(ctx, rest, view), rest);
    const after = drawn((ctx) => drawGround(ctx, moved, view, { x: 50, y: -20 }), moved);
    const shifted = new Map([...before].map(([k, c]) => { const [x, y] = k.split(',').map(Number); return [`${x + 50},${y - 20}`, c]; }));
    expect(after).toEqual(shifted);
  });

  it('draws two blocks of the same size identically wherever they are (a fake wall looks like a real block)', () => {
    const a: Rect = { x: 100, y: 300, width: 40, height: 90 };
    const b: Rect = { x: 517, y: 233, width: 40, height: 90 };
    const at = (r: Rect) => relative(drawn((ctx) => drawBlock(ctx, r, view), r), r);
    expect(at(b)).toEqual(at(a));
  });

  it('only draws pattern inside the visible part of a long ground', () => {
    const { ctx, fills } = recorder();
    drawGround(ctx, { x: 0, y: 500, width: 18000, height: 120 }, { x: 4000, width: 960, height: VIEW_HEIGHT });
    const pattern = fills.slice(2); // 앞의 두 번은 바탕과 풀 띠
    expect(pattern.length).toBeGreaterThan(0);
    expect(pattern.every((f) => f.x >= 4000 - 16 && f.x < 4960 && f.y < VIEW_HEIGHT)).toBe(true);
  });
});

describe('disguised traps look exactly like the ground around them', () => {
  const R: Rect = { x: 320, y: 500, width: 80, height: 120 };
  const ground = (r: Rect) => [{ x: 0, y: 500, width: r.x, height: 120 }, { x: r.x + r.width, y: 500, width: 1000, height: 120 }];
  const shot = (world: World): Map<string, string> => {
    const canvas = document.createElement('canvas');
    const { ctx, fills } = recorder();
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);
    world.player.x = 100; world.player.y = 100; // 플레이어 그림이 R과 겹치지 않게
    new CanvasRenderer(canvas).render(world, { fps: 60, steps: 1 });
    return pixels(fills, { x: R.x, y: R.y, width: R.width, height: VIEW_HEIGHT - R.y });
  };
  const plain = shot(new World(testLevel({ solids: [...ground(R), R] })));
  const cases: [string, Parameters<typeof testLevel>[0]][] = [
    ['fake safe zone (#4)', { solids: ground(R), hazards: [R] }],
    ['hidden block (#1)', { solids: ground(R), hiddenBlocks: [R] }],
    ['vanishing ground (#6)', { solids: ground(R), vanishingGrounds: [R] }],
    ['dodging platform at rest (#8)', { solids: ground(R), dodgingPlatforms: [{ platform: R, trigger: { x: 0, y: 0, width: 1, height: 1 }, to: { x: R.x + 50, y: R.y } }] }],
    ['fake clear floor (#14)', { solids: ground(R), fakeGoals: [{ flag: { x: 1500, y: 400, width: 10, height: 100 }, floor: [R] }] }],
    ['rhythm platform while on (#27)', { solids: ground(R), rhythmPlatforms: [{ rect: R, period: 2, onDuration: 1.5, offset: 0 }] }],
    ['third-landing platform before any landing (#30)', { solids: ground(R), countingPlatforms: [{ rect: R, landings: 3 }] }],
  ];
  for (const [name, parts] of cases) {
    it(name, () => { expect(shot(new World(testLevel(parts)))).toEqual(plain); });
  }
});

describe('ground edges land on whole device pixels', () => {
  // 카메라 위치가 소수(플레이어 x가 소수)이거나 기기 픽셀 비율이 정수가 아니면, 따로 그린 두 바닥이 맞닿는 경계가 픽셀 중간에 걸려
  // 양쪽이 안티앨리어싱되고 그 사이로 배경이 비쳐 이음매가 보였다 — 가짜 클리어 바닥(3800·4100)처럼 위장 바닥의 위치가 드러났다.
  for (const dpr of [1, 1.5, 2]) {
    it(`at device pixel ratio ${dpr} with a fractional camera`, () => {
      vi.stubGlobal('devicePixelRatio', dpr);
      const canvas = document.createElement('canvas');
      const { ctx, fills } = recorder();
      vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);
      const pieces = [0, 400, 440, 480, 900].map((x, i, xs) => ({ x, y: 500, width: (xs[i + 1] ?? 2000) - x, height: 120 }));
      const world = new World(testLevel({ solids: pieces }));
      world.player.x = 700.37; world.player.y = 300;
      new CanvasRenderer(canvas, () => false).render(world, { fps: 60, steps: 1 });
      const scale = canvas.width / 960;
      expect(Number.isInteger(scale)).toBe(true); // 정수 배율로 그리고, 화면 크기는 CSS가 맞춘다
      const edges = fills.filter((f) => f.style === GROUND_FILL).flatMap((f) => [f.x * scale, (f.x + f.width) * scale]);
      expect(edges.length).toBeGreaterThan(4);
      expect(edges.filter((e) => Math.abs(e - Math.round(e)) > 1e-9)).toEqual([]);
      vi.unstubAllGlobals();
    });
  }
});
