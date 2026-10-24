// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { CanvasRenderer, HAZARD_REVEAL_FILL } from '../../../src/game/rendering/CanvasRenderer';
import { World } from '../../../src/game/world/World';
import { HAZARDS } from '../../../src/game/world/level';

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

const hazard = HAZARDS[0];
const hazardFill = (fills: FillCall[]): FillCall | undefined =>
  fills.find((f) => f.x === hazard.x && f.y === hazard.y && f.width === hazard.width && f.height === hazard.height);

describe('CanvasRenderer fake safe zone', () => {
  it('draws the hazard like normal ground when no reveal is active', () => {
    const world = new World();
    expect(hazardFill(renderFills(world))?.style).toBe('#627e55'); // 일반 바닥(SOLIDS)과 같은 색
  });

  it('draws the hazard in the warning color while the post-death reveal is active, and back to ground after it ends', () => {
    const world = new World();
    world.player.x = hazard.x + 1;
    world.player.y = hazard.y - world.player.height + 1;
    world.update(1 / 60, { horizontal: 0, jumpPressed: false, restartPressed: false });
    expect(world.hazardReveal).not.toBeNull();
    expect(hazardFill(renderFills(world))?.style).toBe(HAZARD_REVEAL_FILL);

    world.hazardReveal = null; // 2초 경과 후와 같은 상태
    expect(hazardFill(renderFills(world))?.style).toBe('#627e55');
  });
});
