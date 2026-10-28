import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../../src/game/world/level';
import { BOULDER_SIZE, simulateJump, World } from '../../../src/game/world/World';
import { createPlayer, JUMP_SPEED, SPEED } from '../../../src/game/entities/Player';
import type { Level } from '../../../src/game/world/level';
import { testLevel } from './fixtures';
import type { Rect } from '../../../src/game/physics/AABB';
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

  it('makes every fake wall taller than the highest jump', () => {
    // docs/traps-spec.md #20 배치 제약: 최대 점프 높이(81.375px, docs/physics-spec.md)보다 높아 넘을 수 없어 보여야 한다.
    for (const [i, level] of LEVELS.entries()) {
      for (const w of level.fakeWalls) expect(w.height, `level ${i + 1} fake wall at ${w.x}`).toBeGreaterThan(81.375);
    }
  });

  it('keeps changing solids off every predicted landing-spike trajectory', () => {
    for (const [i, level] of LEVELS.entries()) {
      expect(landingPredictionViolations(level), `level ${i + 1}`).toEqual([]);
    }
  });
});

// docs/traps-spec.md #23 배치 제약: 예측은 점프 순간의 솔리드를 고정된 것으로 보므로, 예측 궤적이 지나가는 수평 범위에는
// 상태나 위치가 바뀌는 솔리드를 두지 않는다. 범위는 구역과 겹치며 솔리드 위에 서 있을 수 있는 모든 정수 x에서, 좌우 입력
// 세 가지(←·없음·→)로 World와 같은 계산(simulateJump)을 돌려 얻는다 — 고정 거리(±200px)로는 낮은 착지면으로 멀리
// 떨어지는 궤적을 덮지 못했다(Codex 리뷰).
function landingPredictionViolations(level: Level): Rect[] {
  const solids = [...level.solids, ...new World(level).dynamicSolids()];
  const changing: Rect[] = [
    ...level.hiddenBlocks, ...level.fallingPlatforms, ...level.vanishingGrounds, ...level.invisibleBlocks,
    ...level.dodgingPlatforms.flatMap((d) => [d.platform, { ...d.platform, ...d.to }]),
    ...level.fallingCeilings.map((c) => c.block), ...level.fakeGoals.flatMap((g) => g.floor),
    ...level.descendingCeilings.map((c) => ({ ...c.block, height: c.floorY - c.block.y })), // 내려오며 지나가는 범위 전체
    ...level.rhythmPlatforms.map((r) => r.rect), ...level.countingPlatforms.map((c) => c.rect),
  ];
  const violations: Rect[] = [];
  for (const zone of level.landingSpikeZones) {
    let lo = Infinity, hi = -Infinity;
    for (const surface of solids) {
      const y = surface.y - 32; // 그 솔리드 위에 선 플레이어(높이 32)
      if (y >= zone.y + zone.height || surface.y <= zone.y) continue; // 구역과 세로로 겹치지 않는다
      for (let x = Math.max(zone.x, surface.x) - 25; x < Math.min(zone.x + zone.width, surface.x + surface.width); x++) {
        for (const h of [-1, 0, 1]) {
          const start = { ...createPlayer(x, y), vx: h * SPEED, vy: -JUMP_SPEED };
          const { minX, maxX } = simulateJump(start, solids, level, 1 / 60);
          lo = Math.min(lo, minX); hi = Math.max(hi, maxX);
        }
      }
    }
    violations.push(...changing.filter((r) => r.x < hi && r.x + r.width > lo));
  }
  return violations;
}

describe('landing-spike prediction rule', () => {
  // 높은 단(y 300, 0-600) 끝에 구역, 그 아래 낮은 바닥(y 600). 낮은 착지면으로 떨어지는 궤적은 200px를 넘어 간다.
  const zone = { x: 540, y: 200, width: 60, height: 100 };
  const base = { solids: [{ x: 0, y: 300, width: 600, height: 320 }, { x: 600, y: 600, width: 1400, height: 20 }], landingSpikeZones: [zone] };

  it('catches a changing solid more than 200px out that a falling trajectory still crosses (Codex review)', () => {
    const fp = { x: 820, y: 560, width: 60, height: 20 };
    expect(fp.x - (zone.x + zone.width)).toBeGreaterThan(200); // 예전 ±200px 규칙은 통과시켰다
    expect(landingPredictionViolations(testLevel({ ...base, fallingPlatforms: [fp] }))).toEqual([fp]);
  });

  it('allows changing solids beyond every predicted trajectory', () => {
    expect(landingPredictionViolations(testLevel({ ...base, fallingPlatforms: [{ x: 1500, y: 560, width: 60, height: 20 }] }))).toEqual([]);
  });
});

describe('landing-spike prediction rule covers timed solids', () => {
  const zone = { x: 540, y: 300, width: 60, height: 200 };
  const ground = { x: 0, y: 500, width: 2000, height: 120 };
  it('rejects a descending ceiling, a rhythm platform or a third-landing platform on the predicted path', () => {
    const ceiling = { block: { x: 650, y: 200, width: 60, height: 40 }, trigger: { x: 900, y: 300, width: 40, height: 200 }, speed: 60, floorY: 500 };
    expect(landingPredictionViolations(testLevel({ solids: [ground], landingSpikeZones: [zone], descendingCeilings: [ceiling] }))).toHaveLength(1);
    const rhythm = { rect: { x: 640, y: 440, width: 60, height: 20 }, period: 2, onDuration: 1, offset: 0 };
    expect(landingPredictionViolations(testLevel({ solids: [ground], landingSpikeZones: [zone], rhythmPlatforms: [rhythm] }))).toEqual([rhythm.rect]);
    const counting = { rect: { x: 640, y: 440, width: 60, height: 20 }, landings: 3 };
    expect(landingPredictionViolations(testLevel({ solids: [ground], landingSpikeZones: [zone], countingPlatforms: [counting] }))).toEqual([counting.rect]);
  });
});
