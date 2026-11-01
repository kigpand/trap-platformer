// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { CanvasRenderer } from '../../../src/game/rendering/CanvasRenderer';
import { World } from '../../../src/game/world/World';
import { LEVELS } from '../../../src/game/world/level';
import { recorder } from './recorder';

// 그리기 양 예산. 2026-11-01 측정(실제 Chromium, 기기 픽셀 비율 2): 모든 레벨을 120px 간격으로 그렸을 때 한 프레임의 fillRect가
// 최대 778번, 그리기 시간은 CPU를 4배 느리게 해도 최대 약 1.3ms였고, 프로덕션 빌드는 CPU 6배 감속에서도 프레임 손실이 없었다.
// 이 테스트는 화면 밖 지형·무늬·배경을 다시 레벨 전체만큼 그리게 되는 회귀를 막는다(예산은 측정 최댓값에 약 30% 여유).
const FILL_BUDGET = 1000;

describe('render budget', () => {
  it(`keeps every frame of every level under ${FILL_BUDGET} fillRect calls`, () => {
    const canvas = document.createElement('canvas');
    const { ctx, fills } = recorder();
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);
    const renderer = new CanvasRenderer(canvas, () => false);
    for (const level of LEVELS) {
      const world = new World(level);
      let worst = { count: 0, x: 0 };
      for (let x = 0; x < level.width; x += 120) {
        world.player.x = x; world.player.y = 300;
        fills.length = 0;
        renderer.render(world, { fps: 60, steps: 1 });
        if (fills.length > worst.count) worst = { count: fills.length, x };
      }
      expect(worst.count, `level ${LEVELS.indexOf(level) + 1} at x=${worst.x}`).toBeLessThanOrEqual(FILL_BUDGET);
      expect(worst.count).toBeGreaterThan(100); // 실제로 그렸는지(빈 그림으로 통과하지 않게)
    }
  });
});
