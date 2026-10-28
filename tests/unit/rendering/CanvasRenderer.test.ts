// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { BOULDER_FILL, CanvasRenderer, DEATH_CAUSE_OVERLAY, GOAL_FILL, HAZARD_REVEAL_FILL, REVERSE_MARK, SKY_WARNING_FILL, SPIKE_FILL, SPRING_FILL, VANISH_WARNING_FILL } from '../../../src/game/rendering/CanvasRenderer';
import { World } from '../../../src/game/world/World';
import { LEVEL_1, type Level } from '../../../src/game/world/level';
import { TAUNTS } from '../../../src/game/rendering/taunts';
import { cameraX, VIEW_WIDTH } from '../../../src/game/world/viewport';
import { testLevel } from '../world/fixtures';

// happy-dom에는 Canvas 2D 구현이 없다. 모든 메서드 호출을 받아 주되 fillRect만 그 시점의 fillStyle과
// 함께 기록하는 가짜 컨텍스트로, "어느 영역을 어떤 색으로 칠했는지"를 검증한다.
interface FillCall { style: string; x: number; y: number; width: number; height: number }
function recordingContext(): { ctx: CanvasRenderingContext2D; fills: FillCall[]; texts: string[] } {
  const fills: FillCall[] = [];
  const texts: string[] = [];
  const state: Record<string | symbol, unknown> = { fillStyle: '' };
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key === 'fillRect') {
        return (x: number, y: number, width: number, height: number) => { fills.push({ style: String(target.fillStyle), x, y, width, height }); };
      }
      if (key === 'fillText') return (text: string) => { texts.push(text); };
      if (key in target) return target[key];
      return () => {}; // 나머지 그리기 메서드는 결과에 영향이 없으므로 무시
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  // 그리기 API 전체를 구현하지 않는 테스트용 대역이라 타입을 맞춰 넘긴다.
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, texts };
}

function render(world: World): { fills: FillCall[]; texts: string[] } {
  const canvas = document.createElement('canvas');
  const { ctx, fills, texts } = recordingContext();
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);
  new CanvasRenderer(canvas).render(world, { fps: 60, steps: 1 });
  return { fills, texts };
}
const renderFills = (world: World): FillCall[] => render(world).fills;

const hazard = LEVEL_1.hazards[0];
const hazardFill = (fills: FillCall[]): FillCall | undefined =>
  fills.find((f) => f.x === hazard.x && f.y === hazard.y && f.width === hazard.width && f.height === hazard.height);

describe('CanvasRenderer fake safe zone', () => {
  it('draws the hazard like normal ground when no reveal is active', () => {
    const world = new World(LEVEL_1);
    expect(hazardFill(renderFills(world))?.style).toBe('#627e55'); // 일반 바닥(SOLIDS)과 같은 색
  });

  it('draws the hazard in the warning color while the post-death reveal is active, and back to ground after it ends', () => {
    const world = new World(LEVEL_1);
    world.player.x = hazard.x + 1;
    world.player.y = hazard.y - world.player.height + 1;
    world.update(1 / 60, { horizontal: 0, jumpPressed: false, restartPressed: false });
    expect(world.deathCause).not.toBeNull();
    expect(hazardFill(renderFills(world))?.style).toBe(HAZARD_REVEAL_FILL);

    world.deathCause = null; // 2초 경과 후와 같은 상태
    expect(hazardFill(renderFills(world))?.style).toBe('#627e55');
  });
});

describe('CanvasRenderer death cause overlay and background', () => {
  it('overlays the warning color on a non-hazard death cause (e.g. a patrol enemy range)', () => {
    const world = new World(LEVEL_1);
    const e = world.enemies[0];
    world.player.x = e.x; world.player.y = e.y;
    world.update(1 / 60, { horizontal: 0, jumpPressed: false, restartPressed: false });
    const cause = world.deathCause?.rect;
    if (!cause) throw new Error('enemy death should set a cause');
    const fills = renderFills(world);
    expect(fills.some((f) => f.style === DEATH_CAUSE_OVERLAY && f.x === cause.x && f.width === cause.width)).toBe(true);
  });

  it('keeps drawing background buildings to the far end of a long level, only around the camera', () => {
    // 이전에는 건물 18개(약 2,340px)까지만 그려 긴 레벨 뒤쪽 배경이 비었다.
    const wide: Level = { ...LEVEL_1, width: 6000, solids: [{ x: 0, y: 500, width: 6000, height: 120 }] };
    const world = new World(wide);
    world.player.x = 5800;
    const cam = cameraX(world.player.x, VIEW_WIDTH, wide.width);
    const buildings = renderFills(world).filter((f) => f.style === '#293b4d');
    expect(buildings.some((f) => f.x + f.width > cam + VIEW_WIDTH - 130)).toBe(true); // 화면 오른쪽 끝까지 이어진다
    // 화면 근처만 그린다(양쪽 가장자리에 걸치는 건물까지 한두 개 여유를 둔다) — 레벨 전체를 그리지 않는다.
    expect(buildings.every((f) => f.x + f.width >= cam - 260 && f.x <= cam + VIEW_WIDTH + 260)).toBe(true);
    expect(buildings.length).toBeLessThan(15);
  });
});

describe('CanvasRenderer terrain traps (#6, #7, #9)', () => {
  const base: Level = {
    ...LEVEL_1, solids: [{ x: 0, y: 500, width: 1800, height: 120 }], hazards: [], fallingPlatforms: [], hiddenBlocks: [],
    enemies: [], ambushes: [], conditionalTraps: [], checkpoints: [],
  };
  const at = (fills: FillCall[], r: { x: number; y: number }) => fills.filter((f) => f.x === r.x && f.y === r.y);

  it('draws vanishing ground like ground, and the next tile to fall in the warning color once it starts', () => {
    const vg = { x: 300, y: 500, width: 160, height: 120 };
    const world = new World({ ...base, vanishingGrounds: [vg] });
    expect(at(renderFills(world), vg).map((f) => f.style)).toContain('#627e55');
    world.vanishingGrounds[0].elapsed = 0.3; world.vanishingGrounds[0].tilesGone = 1; // 첫 칸이 사라진 상태
    const fills = renderFills(world);
    expect(at(fills, vg)).toHaveLength(0); // 첫 칸은 그리지 않는다
    expect(at(fills, { x: vg.x + 40, y: vg.y }).map((f) => f.style)).toContain(VANISH_WARNING_FILL);
  });

  it('does not draw an invisible block until it has appeared', () => {
    const ib = { x: 300, y: 430, width: 60, height: 20 };
    const world = new World({ ...base, invisibleBlocks: [ib] });
    expect(at(renderFills(world), ib)).toHaveLength(0);
    world.invisibleBlocks[0].visible = true;
    expect(at(renderFills(world), ib).length).toBeGreaterThan(0);
  });

  it('draws a falling ceiling at its current position', () => {
    const block = { x: 600, y: 380, width: 40, height: 40 };
    const world = new World({ ...base, fallingCeilings: [{ block, trigger: { x: 560, y: 380, width: 80, height: 120 } }] });
    world.player.x = 500;
    world.fallingCeilings[0].y = 430;
    expect(at(renderFills(world), { x: block.x, y: 430 }).length).toBeGreaterThan(0);
    expect(at(renderFills(world), block)).toHaveLength(0);
  });
});

describe('CanvasRenderer trick traps (#8, #10, #11, #12)', () => {
  const base: Level = {
    ...LEVEL_1, solids: [{ x: 0, y: 500, width: 1800, height: 120 }], hazards: [], fallingPlatforms: [], hiddenBlocks: [],
    enemies: [], ambushes: [], conditionalTraps: [], checkpoints: [],
  };

  it('draws pop-up spikes only once raised', () => {
    const spikes = { x: 400, y: 476, width: 40, height: 24 };
    const world = new World({ ...base, popUpSpikes: [{ spikes, trigger: { x: 340, y: 400, width: 60, height: 100 } }] });
    expect(renderFills(world).some((f) => f.style === SPIKE_FILL)).toBe(false);
    world.popUpSpikes[0].raised = true;
    expect(renderFills(world).some((f) => f.style === SPIKE_FILL && f.x === spikes.x)).toBe(true);
  });

  it('draws a fake checkpoint exactly like an unreached real one', () => {
    const real = { zone: { x: 300, y: 360, width: 40, height: 160 }, respawnX: 300, respawnY: 350 };
    const fake = { x: 500, y: 440, width: 40, height: 60 };
    const world = new World({ ...base, checkpoints: [real], fakeCheckpoints: [fake] });
    const fills = renderFills(world);
    const pole = (z: { x: number; width: number }) => fills.find((f) => f.x === z.x + z.width / 2 - 2 && f.width === 4);
    expect(pole(fake)?.style).toBe(pole(real.zone)?.style);
    // 코덱스 리뷰: 깃대를 영역 높이로 그려, 높은 진짜(160px)와 낮은 가짜(60px)가 한눈에 달라 보였다.
    expect(pole(fake)?.height).toBe(pole(real.zone)?.height);
    expect(pole(fake)!.y + pole(fake)!.height).toBe(fake.y + fake.height); // 둘 다 바닥에서 같은 높이로 선다
  });

  it('draws the goal and a dodging platform at their current positions', () => {
    const platform = { x: 330, y: 480, width: 60, height: 20 };
    const world = new World({ ...base, dodgingPlatforms: [{ platform, trigger: { x: 0, y: 0, width: 1, height: 1 }, to: { x: 420, y: 480 } }] });
    world.dodgingPlatforms[0].x = 400;
    world.goal.rect = { x: 700, y: 440, width: 40, height: 60 };
    const fills = renderFills(world);
    expect(fills.some((f) => f.x === 400 && f.y === 480 && f.style === '#627e55')).toBe(true);
    expect(fills.some((f) => f.x === 700 && f.y === 440 && f.style === '#eab308')).toBe(true);
  });
});

describe('CanvasRenderer enemies raining from the sky (#13)', () => {
  const group = { trigger: { x: 400, y: 400, width: 40, height: 100 }, drops: [{ x: 560, delay: 0, minX: 520, maxX: 640 }] };
  const level: Level = {
    ...LEVEL_1, solids: [{ x: 0, y: 500, width: 1800, height: 120 }], hazards: [], fallingPlatforms: [], hiddenBlocks: [],
    enemies: [], ambushes: [], conditionalTraps: [], checkpoints: [], skyDrops: [group],
  };

  it('blinks a warning at the top of the screen above the drop spot, and draws the enemy once it falls', () => {
    const world = new World(level);
    world.player.x = 300;
    expect(renderFills(world).some((f) => f.style === SKY_WARNING_FILL)).toBe(false); // 트리거 전
    world.skyDrops[0].elapsed = 0.01; world.skyDrops[0].enemies[0].phase = 'warning';
    expect(renderFills(world).some((f) => f.style === SKY_WARNING_FILL && f.x === 560 && f.y === 0)).toBe(true);
    world.skyDrops[0].enemies[0].phase = 'falling';
    world.skyDrops[0].enemies[0].enemy = { x: 560, y: 200, width: 28, height: 28, vx: 120, minX: 520, maxX: 640 };
    const fills = renderFills(world);
    expect(fills.some((f) => f.x >= 560 && f.x < 588 && f.y >= 200 && f.y < 228)).toBe(true); // 적 스프라이트 픽셀
  });
});

describe('CanvasRenderer taunting death message', () => {
  it('shows the taunt for the cause while it lasts, and nothing otherwise', () => {
    const world = new World(LEVEL_1);
    expect(render(world).texts.some((t) => Object.values(TAUNTS).includes(t))).toBe(false);
    const hazard = LEVEL_1.hazards[0];
    world.player.x = hazard.x + 1; world.player.y = hazard.y - world.player.height + 1;
    world.update(1 / 60, { horizontal: 0, jumpPressed: false, restartPressed: false });
    expect(render(world).texts).toContain(TAUNTS.hazard);
    world.taunt = null;
    expect(render(world).texts).not.toContain(TAUNTS.hazard);
  });
});

describe('CanvasRenderer forced flight and reverse traps', () => {
  const tile = { x: 600, y: 500, width: 40, height: 20 };
  const springLevel: Level = { ...LEVEL_1, springFloors: [{ tile, vx: -480, vy: -600 }] };

  it('draws the spring tile like plain floor until it bounces, then as a pressed spring, with its taunt', () => {
    const world = new World(springLevel);
    expect(renderFills(world).some((f) => f.style === SPRING_FILL)).toBe(false);
    world.player.x = tile.x; world.player.y = tile.y - world.player.height; world.player.vy = 0; world.player.grounded = true;
    world.update(1 / 60, { horizontal: 0, jumpPressed: false, restartPressed: false });
    const { fills, texts } = render(world);
    expect(fills.some((f) => f.style === SPRING_FILL && f.x >= tile.x && f.x < tile.x + tile.width && f.y === tile.y)).toBe(true);
    expect(texts).toContain(TAUNTS.springFloor);
  });

  it('shows the reverse mark above the player only while reversed', () => {
    const zone = { x: 600, y: 300, width: 200, height: 200 };
    const world = new World({ ...LEVEL_1, reverseZones: [zone] });
    expect(render(world).texts).not.toContain(REVERSE_MARK);
    world.player.x = 650; world.player.y = 468; world.player.vy = 0; world.player.grounded = true;
    world.update(1 / 60, { horizontal: 0, jumpPressed: false, restartPressed: false });
    expect(world.reverse).not.toBeNull();
    expect(render(world).texts).toContain(REVERSE_MARK);
  });
});

describe('CanvasRenderer fake clear and fake signs', () => {
  const flag = { x: 700, y: 440, width: 40, height: 60 };
  const floor = { x: 600, y: 500, width: 240, height: 120 };
  const level = testLevel({ fakeGoals: [{ flag, floor: [floor] }], signs: [{ x: 300, y: 500, text: '여기서 점프!' }] });

  it('draws the fake flag like the goal, and LEVEL CLEAR while the fake clear lasts', () => {
    const world = new World(level);
    const same = (f: { style: string; x: number; y: number; width: number; height: number }, r: typeof flag) =>
      f.x === r.x && f.y === r.y && f.width === r.width && f.height === r.height;
    expect(renderFills(world).some((f) => f.style === GOAL_FILL && same(f, flag))).toBe(true);
    expect(renderFills(world).some((f) => same(f, floor))).toBe(true);
    expect(render(world).texts).not.toContain('LEVEL CLEAR');
    world.player.x = flag.x; world.player.y = 468; world.player.vy = 0; world.player.grounded = true;
    world.update(1 / 60, { horizontal: 0, jumpPressed: false, restartPressed: false });
    expect(render(world).texts).toContain('LEVEL CLEAR');
    world.collapseFakeFloor();
    expect(render(world).texts).not.toContain('LEVEL CLEAR');
    expect(renderFills(world).some((f) => same(f, floor))).toBe(false); // 꺼진 바닥은 그리지 않는다
  });

  it('draws each sign with its text', () => {
    expect(render(new World(level)).texts).toContain('여기서 점프!');
  });
});

describe('CanvasRenderer rolling boulder', () => {
  it('draws the boulder only while it rolls', () => {
    const trigger = { x: 600, y: 300, width: 40, height: 200 };
    const world = new World(testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }], boulders: [{ trigger, startX: 380, endX: 1900, y: 440 }] }));
    expect(renderFills(world).some((f) => f.style === BOULDER_FILL)).toBe(false);
    world.player.x = 600; world.player.y = 468; world.player.vy = 0; world.player.grounded = true;
    world.update(1 / 60, { horizontal: 0, jumpPressed: false, restartPressed: false });
    expect(renderFills(world).some((f) => f.style === BOULDER_FILL && f.x >= 380 && f.x < 440 && f.y >= 440 && f.y < 500)).toBe(true);
  });
});
