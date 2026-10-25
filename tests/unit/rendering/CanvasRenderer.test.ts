// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { CanvasRenderer, DEATH_CAUSE_OVERLAY, HAZARD_REVEAL_FILL, SPIKE_FILL, VANISH_WARNING_FILL } from '../../../src/game/rendering/CanvasRenderer';
import { World } from '../../../src/game/world/World';
import { LEVEL_1, type Level } from '../../../src/game/world/level';
import { cameraX, VIEW_WIDTH } from '../../../src/game/world/viewport';

// happy-dom에는 Canvas 2D 구현이 없다. 모든 메서드 호출을 받아 주되 fillRect만 그 시점의 fillStyle과
// 함께 기록하는 가짜 컨텍스트로, "어느 영역을 어떤 색으로 칠했는지"를 검증한다.
interface FillCall { style: string; x: number; y: number; width: number; height: number }
function recordingContext(): { ctx: CanvasRenderingContext2D; fills: FillCall[] } {
  const fills: FillCall[] = [];
  const state: Record<string | symbol, unknown> = { fillStyle: '' };
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key === 'fillRect') {
        return (x: number, y: number, width: number, height: number) => { fills.push({ style: String(target.fillStyle), x, y, width, height }); };
      }
      if (key in target) return target[key];
      return () => {}; // 나머지 그리기 메서드는 결과에 영향이 없으므로 무시
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  // 그리기 API 전체를 구현하지 않는 테스트용 대역이라 타입을 맞춰 넘긴다.
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
}

function renderFills(world: World): FillCall[] {
  const canvas = document.createElement('canvas');
  const { ctx, fills } = recordingContext();
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);
  new CanvasRenderer(canvas).render(world, { fps: 60, steps: 1 });
  return fills;
}

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

