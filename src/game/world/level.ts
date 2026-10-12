import type { Rect } from '../physics/AABB';
export const WORLD_WIDTH = 1800;
export const WORLD_HEIGHT = 620;
export const SPAWN = { x: 65, y: 350 };
export const SOLIDS: readonly Rect[] = [
  { x: 0, y: 500, width: 300, height: 120 },
  { x: 380, y: 500, width: 140, height: 120 },
  { x: 620, y: 500, width: 570, height: 120 },
  { x: 1290, y: 500, width: 510, height: 120 },
  { x: 250, y: 420, width: 110, height: 20 },
  { x: 480, y: 350, width: 130, height: 20 },
  { x: 830, y: 410, width: 120, height: 20 },
  { x: 1130, y: 350, width: 110, height: 20 },
  { x: 1430, y: 400, width: 120, height: 20 },
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
export interface Checkpoint { zone: Rect; respawnX: number; respawnY: number }
// 중간 체크포인트: 적 구간(850)과 위험지대(1060) 사이 평지에 배치. 접촉하면 이후 사망 시
// 레벨 시작점 대신 여기서 다시 시작한다(수동 재시작(R)은 체크포인트를 초기화하고 처음부터 시작).
export const CHECKPOINTS: readonly Checkpoint[] = [
  { zone: { x: 950, y: 440, width: 40, height: 80 }, respawnX: 950, respawnY: 350 },
];
