import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../../src/game/world/level';
import { BOULDER_SIZE } from '../../../src/game/world/World';
import { cameraX, VIEW_WIDTH } from '../../../src/game/world/viewport';

// 모든 레벨 데이터에 대한 배치 규칙(docs/physics-spec.md "레벨 배치 제약").
describe('level placement rules (every level)', () => {
  it('shows each fake safe zone on screen right after respawning at the checkpoint before it', () => {
    // 코덱스 리뷰: 레벨 3 체크포인트 3(3200)에서 재시작하면 가짜 안전지대(3920)가 화면 밖이라, 사망 원인 표시를
    // 재시작 화면에서 바로 볼 수 없었다. 이 규칙은 가짜 안전지대 앞에 건너뛸 수 없는 체크포인트를 두는 이유다.
    for (const [i, level] of LEVELS.entries()) {
      for (const hazard of level.hazards) {
        const before = level.checkpoints.filter((cp) => cp.zone.x + cp.zone.width <= hazard.x);
        expect(before.length, `level ${i + 1} hazard at ${hazard.x} has no checkpoint before it`).toBeGreaterThan(0);
        const cp = before.reduce((a, b) => (b.zone.x > a.zone.x ? b : a));
        const left = cameraX(cp.respawnX, VIEW_WIDTH, level.width);
        expect(hazard.x + hazard.width, `level ${i + 1} hazard at ${hazard.x} vs checkpoint at ${cp.respawnX}`).toBeLessThanOrEqual(left + VIEW_WIDTH);
      }
    }
  });

  it('keeps every fake sign to 12 characters or fewer', () => {
    // docs/traps-spec.md #18 배치 제약: 문구는 12자 이하(판자 너비에 맞춤).
    for (const [i, level] of LEVELS.entries()) {
      for (const sign of level.signs) expect([...sign.text].length, `level ${i + 1} sign "${sign.text}"`).toBeLessThanOrEqual(12);
    }
  });

  it('spawns every rolling boulder at least 160px behind its trigger', () => {
    // docs/traps-spec.md #19 배치 제약: 시작 x + 60 ≤ 트리거 x − 160 — 트리거 근처에서 생기면 피할 수 없이 깔린다.
    for (const [i, level] of LEVELS.entries()) {
      for (const b of level.boulders) {
        expect(b.startX + BOULDER_SIZE, `level ${i + 1} boulder triggered at ${b.trigger.x}`).toBeLessThanOrEqual(b.trigger.x - 160);
      }
    }
  });
});
