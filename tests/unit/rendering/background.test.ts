import { describe, expect, it } from 'vitest';
import { drawBackground, FAR_CITY, FAR_PARALLAX, NEAR_CITY, NEAR_PARALLAX } from '../../../src/game/rendering/background';
import { recorder, type Fill } from './recorder';

const view = { width: 960, height: 540 };
const draw = (cam: number): Fill[] => { const { ctx, fills } = recorder(); drawBackground(ctx, cam, view); return fills; };
// 한 겹(색 하나)의 건물을 dx만큼 옮긴 "x,y,너비,높이" 목록. 두 화면에 모두 온전히 들어오는 건물만 비교한다.
const layer = (fills: Fill[], color: string, dx = 0): string[] =>
  fills.filter((f) => f.style === color).map((f) => ({ ...f, x: f.x + dx }))
    .filter((f) => f.x >= 300 && f.x + f.width <= 660).map((f) => `${f.x},${f.y},${f.width},${f.height}`);
describe('background', () => {
  it('fills the whole screen with sky and draws the same picture every frame', () => {
    const fills = draw(1234);
    expect(fills.slice(0, 6).reduce((h, f) => h + f.height, 0)).toBeGreaterThanOrEqual(view.height); // 하늘 띠가 화면 전체를 덮는다
    expect(fills.slice(0, 6).every((f) => f.x === 0 && f.width === view.width)).toBe(true);
    expect(draw(1234)).toEqual(fills);
  });

  it('moves the city layers slower than the camera (near at 1/2, far at 1/4)', () => {
    // 카메라가 400px 가면 가까운 겹은 200px, 먼 겹은 100px만 화면에서 밀린다 — 지형과 다르게 움직여 배경으로 읽힌다.
    const a = draw(1000), b = draw(1400);
    const shiftNear = 400 * NEAR_PARALLAX, shiftFar = 400 * FAR_PARALLAX;
    expect(layer(b, NEAR_CITY, shiftNear)).toEqual(layer(a, NEAR_CITY));
    expect(layer(b, FAR_CITY, shiftFar)).toEqual(layer(a, FAR_CITY));
    expect(layer(a, NEAR_CITY).length).toBeGreaterThan(0);
    expect(layer(a, FAR_CITY).length).toBeGreaterThan(0);
  });

  it('keeps the city going to the far end of a long level while drawing only buildings near the screen', () => {
    for (const cam of [0, 17640]) { // 레벨 4 끝(18,600 - 960)까지
      const near = draw(cam).filter((f) => f.style === NEAR_CITY);
      expect(near.some((f) => f.x <= 0)).toBe(true);
      expect(near.some((f) => f.x + f.width >= view.width - 40)).toBe(true); // 화면 오른쪽 끝까지 이어진다
      expect(near.every((f) => f.x + f.width >= -130 && f.x <= view.width + 130)).toBe(true);
      expect(near.length).toBeLessThan(12);
    }
  });
});
