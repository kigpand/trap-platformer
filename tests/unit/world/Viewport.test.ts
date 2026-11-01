import { describe, expect, it } from 'vitest';
import { cameraX, isWithinHearing, VIEW_WIDTH } from '../../../src/game/world/viewport';

// 화면 밖 소리 규칙(docs/game-design.md "소리"): 화면 안이거나 화면 가장자리에서 한 화면 폭 안이면 들린다.
describe('isWithinHearing', () => {
  const levelWidth = 16000;
  const playerX = 5000;
  const left = cameraX(playerX, VIEW_WIDTH, levelWidth); // 화면 왼쪽 끝 = 플레이어 − 384
  const box = (x: number) => ({ x, y: 400, width: 40, height: 40 });

  it('hears things on screen and up to one screen width past either edge', () => {
    expect(isWithinHearing(box(playerX), playerX, levelWidth)).toBe(true);
    expect(isWithinHearing(box(left + VIEW_WIDTH + 500), playerX, levelWidth)).toBe(true); // 화면 밖에서 들어오는 화살(레벨 2 약 600px 밖)
    expect(isWithinHearing(box(left - VIEW_WIDTH + 1), playerX, levelWidth)).toBe(true);
  });

  it('does not hear things more than a screen width away, like a ceiling left far behind', () => {
    expect(isWithinHearing(box(left - VIEW_WIDTH - 40), playerX, levelWidth)).toBe(false);
    expect(isWithinHearing(box(left + 2 * VIEW_WIDTH), playerX, levelWidth)).toBe(false);
  });
});
