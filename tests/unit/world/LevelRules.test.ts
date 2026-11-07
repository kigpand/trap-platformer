import { describe, expect, it } from 'vitest';
import { LEVELS, staticSolids } from '../../../src/game/world/level';
import { BOULDER_SIZE, simulateJump, vanishingTile, vanishingTileCount, World } from '../../../src/game/world/World';
import { MAX_SUBSTEP } from '../../../src/game/physics/Collision';
import { createPlayer, JUMP_SPEED, PLAYER_WIDTH, SPEED } from '../../../src/game/entities/Player';
import type { Level } from '../../../src/game/world/level';
import { testLevel } from './fixtures';
import type { Rect } from '../../../src/game/physics/AABB';
import { cameraX, VIEW_WIDTH } from '../../../src/game/world/viewport';

// 모든 레벨 데이터에 대한 배치 규칙(docs/physics-spec.md "레벨 배치 제약").
describe('level placement rules (every level)', () => {
  it('keeps every solid thicker than the collision substep (ADR-0002 invariant)', () => {
    // 이동은 MAX_SUBSTEP 이하로 나뉘어 매번 겹침을 확인한다. 솔리드의 너비·높이가 그보다 크면 한 서브스텝에 건너뛸 수 없다.
    // 충돌 테스트는 플레이어가 솔리드보다 커서 이 불변식이 깨져도 통과하므로(ADR-0002 재검토 기록), 레벨 데이터로 직접 확인한다.
    for (const level of LEVELS) {
      const solids: Rect[] = [
        ...staticSolids(level), ...level.hazards, ...level.fallingPlatforms, ...level.hiddenBlocks, ...level.invisibleBlocks,
        ...level.vanishingGrounds.flatMap((v) => Array.from({ length: vanishingTileCount(v) }, (_, i) => vanishingTile(v, i))),
        ...level.fallingCeilings.map((c) => c.block), ...level.dodgingPlatforms.map((d) => d.platform),
        ...level.fakeGoals.flatMap((g) => g.floor), ...level.descendingCeilings.map((c) => c.block),
        ...level.rhythmPlatforms.map((r) => r.rect), ...level.countingPlatforms.map((c) => c.rect),
      ];
      expect(solids.length).toBeGreaterThan(10);
      const thin = solids.filter((r) => Math.min(r.width, r.height) <= MAX_SUBSTEP);
      expect(thin, `level ${LEVELS.indexOf(level) + 1}`).toEqual([]);
    }
  });

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

  it('keeps every pipe and hill standing on ground and climbable with one jump per step', () => {
    for (const [i, level] of LEVELS.entries()) expect(terrainFeatureViolations(level), `level ${i + 1}`).toEqual([]);
  });

  it('keeps changing solids off every predicted landing-spike trajectory', () => {
    for (const [i, level] of LEVELS.entries()) {
      expect(landingPredictionViolations(level), `level ${i + 1}`).toEqual([]);
    }
  });
});

// 지형지물 배치 제약(docs/physics-spec.md "레벨 배치 제약"): 파이프·언덕은 받치는 바닥(level.solids) 위에 서고, 파이프 높이와
// 언덕 한 단의 높이는 최대 점프 높이(81.375px)보다 낮으며, 언덕의 단·꼭대기는 플레이어가 설 수 있을 만큼 넓다.
const MAX_JUMP_HEIGHT = 81.375;
function terrainFeatureViolations(level: Level): string[] {
  const out: string[] = [];
  const standsOnGround = (x: number, width: number, bottom: number): boolean =>
    level.solids.some((s) => s.y === bottom && s.x <= x && s.x + s.width >= x + width);
  for (const p of level.pipes) {
    if (!standsOnGround(p.x, p.width, p.y + p.height)) out.push(`pipe at ${p.x} does not stand on ground`);
    if (p.height >= MAX_JUMP_HEIGHT) out.push(`pipe at ${p.x} is too tall to jump onto`);
  }
  for (const h of level.hills) {
    const width = h.topWidth + 2 * (h.steps - 1) * h.stepWidth;
    if (!standsOnGround(h.x, width, h.y)) out.push(`hill at ${h.x} does not stand on ground`);
    if (h.stepHeight >= MAX_JUMP_HEIGHT) out.push(`hill at ${h.x} has steps too tall to jump`);
    if (Math.min(h.stepWidth, h.topWidth) < PLAYER_WIDTH) out.push(`hill at ${h.x} has steps too narrow to stand on`);
  }
  return out;
}

describe('terrain feature placement rule', () => {
  const ground = { x: 0, y: 500, width: 1000, height: 120 };
  const hill = { x: 400, y: 500, steps: 3, stepWidth: 40, stepHeight: 40, topWidth: 80 };
  it('accepts pipes and hills on the ground within jump height', () => {
    expect(terrainFeatureViolations(testLevel({ solids: [ground], pipes: [{ x: 200, y: 440, width: 60, height: 60 }], hills: [hill] }))).toEqual([]);
  });
  it('rejects floating, too tall or too narrow features', () => {
    expect(terrainFeatureViolations(testLevel({
      solids: [ground],
      pipes: [{ x: 200, y: 400, width: 60, height: 60 }, { x: 300, y: 410, width: 60, height: 90 }, { x: 980, y: 440, width: 60, height: 60 }],
      hills: [{ ...hill, stepHeight: 82 }, { ...hill, stepWidth: PLAYER_WIDTH - 1 }, { ...hill, y: 480 }],
    }))).toEqual([
      'pipe at 200 does not stand on ground', 'pipe at 300 is too tall to jump onto', 'pipe at 980 does not stand on ground',
      'hill at 400 has steps too tall to jump', 'hill at 400 has steps too narrow to stand on', 'hill at 400 does not stand on ground',
    ]);
  });
});

// docs/traps-spec.md #23 배치 제약: 예측은 점프 순간의 솔리드를 고정된 것으로 보므로, 예측 궤적이 지나가는 수평 범위에는
// 상태나 위치가 바뀌는 솔리드를 두지 않는다. 범위는 구역과 겹치며 솔리드 위에 서 있을 수 있는 모든 정수 x에서, 좌우 입력
// 세 가지(←·없음·→)로 World와 같은 계산(simulateJump)을 돌려 얻는다 — 고정 거리(±200px)로는 낮은 착지면으로 멀리
// 떨어지는 궤적을 덮지 못했다(Codex 리뷰).
function landingPredictionViolations(level: Level): Rect[] {
  const world = new World(level);
  const solids = [...world.terrain, ...world.dynamicSolids()];
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

describe('falling ceiling placement (every level)', () => {
  it('starts each trigger at most 30px before its block, so a full-speed drop still catches a walker', () => {
    // docs/traps-spec.md #9: 트리거 0.1초 뒤 최대 속도로 떨어져 약 0.19초 만에 닿는다. 그사이 걸어오는 플레이어는 약 40px 나아가므로,
    // 트리거가 블록보다 그보다 멀리 앞에 있으면 블록이 플레이어 앞에 떨어져 그냥 장애물이 된다.
    for (const [i, level] of LEVELS.entries()) {
      for (const c of level.fallingCeilings) expect(c.block.x - c.trigger.x, `level ${i + 1} ceiling at ${c.block.x}`).toBeLessThanOrEqual(30);
    }
  });
});
