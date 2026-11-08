// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { CanvasRenderer, VIEW_HEIGHT } from '../../../src/game/rendering/CanvasRenderer';
import { BELT_FILL, drawBlock, drawConveyor, drawGround, drawMud, drawPipe, drawTrampoline, drawWind, GROUND_FILL, GROUND_TOP, MUD_FILL, PIPE_CAP, PIPE_FILL, TRAMPOLINE_MAT } from '../../../src/game/rendering/terrain';
import { hillColumns, type Hill } from '../../../src/game/world/level';
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

describe('terrain features', () => {
  const shot = (world: World, area: Rect): Map<string, string> => {
    const canvas = document.createElement('canvas');
    const { ctx, fills } = recorder();
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);
    world.player.x = 100; world.player.y = 100; // 플레이어 그림이 지형지물과 겹치지 않게
    new CanvasRenderer(canvas, () => false).render(world, { fps: 60, steps: 1 });
    return pixels(fills, area);
  };
  const ground = { x: 0, y: 500, width: 2000, height: 120 };

  it('paints a pipe only inside its collision rect, with a cap band on top', () => {
    const pipe: Rect = { x: 400, y: 440, width: 60, height: 60 };
    const { ctx, fills } = recorder();
    drawPipe(ctx, pipe);
    for (const f of fills) {
      expect(f.x).toBeGreaterThanOrEqual(pipe.x); expect(f.y).toBeGreaterThanOrEqual(pipe.y);
      expect(f.x + f.width).toBeLessThanOrEqual(pipe.x + pipe.width); expect(f.y + f.height).toBeLessThanOrEqual(pipe.y + pipe.height);
    }
    const map = pixels(fills, pipe);
    expect(map.size).toBe(pipe.width * pipe.height);
    expect(map.get('430,442')).toBe(PIPE_CAP);
    expect(map.get('430,480')).toBe(PIPE_FILL);
  });

  it('draws two pipes of the same size identically wherever they are', () => {
    const a: Rect = { x: 100, y: 440, width: 60, height: 60 };
    const b: Rect = { x: 733, y: 391, width: 60, height: 60 };
    const at = (r: Rect) => relative(drawn((ctx) => drawPipe(ctx, r), r), r);
    expect(at(b)).toEqual(at(a));
  });

  it('draws a sinking pipe at rest exactly like a real pipe on the ground (#32)', () => {
    const pipe: Rect = { x: 400, y: 440, width: 60, height: 60 };
    const area = { x: 380, y: 400, width: 100, height: VIEW_HEIGHT - 400 };
    const real = shot(new World(testLevel({ solids: [ground], pipes: [pipe] })), area);
    const gap = [{ x: 0, y: 500, width: 400, height: 120 }, { x: 460, y: 500, width: 1540, height: 120 }];
    const sinking = shot(new World(testLevel({ solids: gap, sinkingPipes: [{ pipe, delay: 0.3 }] })), area);
    expect(sinking).toEqual(real);
  });

  it('hides the part of a rising enemy that is still inside the pipe (#31)', () => {
    const pipe: Rect = { x: 400, y: 440, width: 60, height: 60 };
    const world = new World(testLevel({ solids: [ground], pipes: [pipe], pipeEnemies: [{ pipe, trigger: { x: 0, y: 0, width: 1, height: 1 }, minX: 200, maxX: 400 }] }));
    const pe = world.pipeEnemies[0];
    pe.phase = 'emerging'; pe.enemy = { x: 416, y: 426, width: 28, height: 28, vx: -120, minX: 200, maxX: 400 };
    const plainWorld = new World(testLevel({ solids: [ground], pipes: [pipe] }));
    expect(shot(world, pipe)).toEqual(shot(plainWorld, pipe));
    const above = { x: 416, y: 426, width: 28, height: 14 };
    expect(shot(world, above)).not.toEqual(shot(plainWorld, above)); // 입구 위로 나온 부분은 보인다
  });

  it('draws the level pipes and hills (hills as ground columns with grass on every exposed step)', () => {
    const pipe: Rect = { x: 300, y: 440, width: 60, height: 60 };
    const hill: Hill = { x: 500, y: 500, steps: 3, stepWidth: 40, stepHeight: 40, topWidth: 80 };
    const area = { x: 300, y: 300, width: 500, height: 200 };
    const map = shot(new World(testLevel({ solids: [ground], pipes: [pipe], hills: [hill] })), area);
    expect(map.get('330,480')).toBe(PIPE_FILL);
    const asGround = drawn((ctx) => { for (const c of hillColumns(hill)) drawGround(ctx, c, view); }, { x: 500, y: 380, width: 240, height: 120 });
    for (const [k, c] of asGround) expect(map.get(k), k).toBe(c);
    for (const c of hillColumns(hill)) expect(map.get(`${c.x + 3},${c.y}`), `step at ${c.x}`).toBe(GROUND_TOP);
  });
});

describe('movement terrain (trampoline, conveyor, mud)', () => {
  const inside = (fills: { x: number; y: number; width: number; height: number }[], r: Rect) => fills.every((f) =>
    f.x >= r.x && f.y >= r.y && f.x + f.width <= r.x + r.width && f.y + f.height <= r.y + r.height);

  it('paints each one only inside its rect', () => {
    const t: Rect = { x: 400, y: 500, width: 40, height: 20 };
    const a = recorder(); drawTrampoline(a.ctx, t);
    expect(inside(a.fills, t)).toBe(true);
    expect(pixels(a.fills, t).get('420,501')).toBe(TRAMPOLINE_MAT);
    const belt: Rect = { x: 300, y: 500, width: 400, height: 20 };
    const b = recorder(); drawConveyor(b.ctx, belt, 90, 0.37, view);
    expect(inside(b.fills, belt)).toBe(true);
    expect(new Set(pixels(b.fills, belt).values())).toContain(BELT_FILL);
    const mud: Rect = { x: 300, y: 500, width: 400, height: 20 };
    const c = recorder(); drawMud(c.ctx, mud, view);
    expect(inside(c.fills, mud)).toBe(true);
    expect(pixels(c.fills, mud).get('301,500')).toBe(MUD_FILL);
  });

  it('points the belt arrows with its direction and moves them with time', () => {
    const belt: Rect = { x: 300, y: 500, width: 200, height: 20 };
    const at = (speed: number, phase: number) => drawn((ctx) => drawConveyor(ctx, belt, speed, phase, view), belt);
    expect(at(90, 0)).not.toEqual(at(-90, 0));
    expect(at(90, 0)).not.toEqual(at(90, 0.05));
  });

  it('is drawn by the renderer so the player can see it (not disguised as ground)', () => {
    const level = testLevel({
      solids: [{ x: 0, y: 500, width: 2000, height: 120 }],
      trampolines: [{ tile: { x: 400, y: 500, width: 40, height: 20 }, speed: 720 }],
      conveyors: [{ rect: { x: 500, y: 500, width: 100, height: 20 }, speed: 90 }],
      mudFloors: [{ x: 650, y: 500, width: 100, height: 20 }],
    });
    const canvas = document.createElement('canvas');
    const { ctx, fills } = recorder();
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);
    const world = new World(level);
    world.player.x = 100; world.player.y = 100;
    new CanvasRenderer(canvas, () => false).render(world, { fps: 60, steps: 1 });
    const map = pixels(fills, { x: 380, y: 500, width: 400, height: 12 });
    expect(map.get('420,501')).toBe(TRAMPOLINE_MAT);
    expect(map.get('550,509')).toBe(BELT_FILL);
    expect(map.get('651,500')).toBe(MUD_FILL);
    expect(map.get('390,505')).not.toBe(TRAMPOLINE_MAT); // 바깥은 그대로 땅
  });
});

describe('wind zone drawing', () => {
  it('paints only inside the zone and moves its streaks up with time', () => {
    const zone: Rect = { x: 300, y: 250, width: 200, height: 250 };
    const r = recorder(); drawWind(r.ctx, zone, 0.3, view);
    expect(r.fills.every((f) => f.x >= zone.x && f.y >= zone.y && f.x + f.width <= zone.x + zone.width && f.y + f.height <= zone.y + zone.height)).toBe(true);
    const at = (phase: number) => drawn((ctx) => drawWind(ctx, zone, phase, view), zone);
    expect(at(0)).not.toEqual(at(0.1));
  });
});
