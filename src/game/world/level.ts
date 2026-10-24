import type { Rect } from '../physics/AABB';
export const WORLD_WIDTH = 1800;
export const WORLD_HEIGHT = 620;
export const SPAWN = { x: 65, y: 350 };
// ground1a/ground1b: 숨겨진 블록(HIDDEN_BLOCKS)이 메우는 틈(300-380)으로 나뉜 시작 구간.
// ground2: 적·체크포인트·위험지대·gap1 점프 착지 구간. ground3: 낙하 발판 다리 너머, 목표 구간.
export const SOLIDS: readonly Rect[] = [
  { x: 0, y: 500, width: 300, height: 120 },
  { x: 380, y: 500, width: 140, height: 120 },
  { x: 620, y: 500, width: 570, height: 120 },
  { x: 1290, y: 500, width: 510, height: 120 },
];
export const GOAL: Rect = { x: 1740, y: 440, width: 40, height: 60 };
// 가짜 안전지대: 실제 바닥(ground2) 위에 겹쳐진 위장 타일. 걸어서 그대로 도달 가능하며
// 시각적으로는 일반 바닥과 동일하게 그려짐 (docs/traps-spec.md #4)
export const HAZARDS: readonly Rect[] = [{ x: 1060, y: 495, width: 80, height: 25 }];
// 낙하하는 발판: ground2 가장자리(1190)에서 ground3 방향으로 낮게 이어지는 다리.
// 최대 점프 높이(약 81px)보다 낮아 ground2 가장자리에서 뛰면 바로 착지한다 (docs/traps-spec.md #2)
export const FALLING_PLATFORMS: readonly Rect[] = [{ x: 1190, y: 480, width: 150, height: 20 }];
// 숨겨진 블록: ground1의 틈(300-380)을 완전히 채워 평소엔 일반 바닥과 이음매 없이 동일하다.
// 점프 없이 걸어서 그대로 접촉하며, 사라지면 진짜 구덩이가 생긴다 (docs/traps-spec.md #1)
export const HIDDEN_BLOCKS: readonly Rect[] = [{ x: 300, y: 500, width: 80, height: 120 }];
export interface EnemyPatrol { minX: number; maxX: number; y: number }
// 적: ground2 위를 왕복. y는 바닥(500)에 발이 닿는 높이(500-28), 위험지대(1060-1140)와 겹치지 않는
// 구간을 왕복한다 (docs/traps-spec.md 적 충돌 규칙)
export const ENEMIES: readonly EnemyPatrol[] = [{ minX: 700, maxX: 850, y: 472 }];
export interface AmbushEnemy extends EnemyPatrol { trigger: Rect }
// 갑자기 출현하는 적: 트리거 영역(1400-1440) 진입 시 0.3초 경고 후 등장한다. 등장 위치(1550)는
// 트리거보다 150px 앞이라 전력 질주해도 0.3초 경고보다 먼저 들이닥치지 않는다 (docs/traps-spec.md #3)
export const AMBUSH_ENEMIES: readonly AmbushEnemy[] = [
  { trigger: { x: 1400, y: 440, width: 40, height: 80 }, minX: 1550, maxX: 1650, y: 472 },
];
export interface ConditionalTrap { zone: Rect }
// 조건부 함정 트리거: "영역 내 1초 이상 체류" 조건(docs/traps-spec.md #5의 두 예시 중 선택 —
// 스위치 순서 조합은 상태 머신이 필요해 범위를 벗어남). 폭 50px은 210px/s로 지나가면 약 0.24초라
// 평범하게 통과하면 안전하고, 멈춰 서 있을 때만 위험하다. 발동 시 가짜 안전지대와 같은 즉시 사망.
export const CONDITIONAL_TRAPS: readonly ConditionalTrap[] = [
  { zone: { x: 1670, y: 440, width: 50, height: 80 } },
];
export interface Checkpoint { zone: Rect; respawnX: number; respawnY: number }
// 중간 체크포인트: 적 구간(850)과 위험지대(1060) 사이 평지에 배치. 접촉하면 이후 사망 시
// 레벨 시작점 대신 여기서 다시 시작한다(수동 재시작(R)은 체크포인트를 초기화하고 처음부터 시작).
// 영역 위쪽(360)은 바닥(500)에서 최대 점프 높이(81.375px)로 올라간 발 위치(약 419)보다 높아, 점프로
// 넘어가도 반드시 닿는다 — 가짜 안전지대 사망 후 표시가 재시작 화면 안에 들어오도록(physics-spec "레벨 배치 제약").
export const CHECKPOINTS: readonly Checkpoint[] = [
  { zone: { x: 950, y: 360, width: 40, height: 160 }, respawnX: 950, respawnY: 350 },
];
