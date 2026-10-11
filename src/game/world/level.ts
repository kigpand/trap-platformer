import type { Rect } from '../physics/AABB';
export const WORLD_WIDTH = 1800;
export const WORLD_HEIGHT = 620;
export const SPAWN = { x: 65, y: 350 };
export const SOLIDS: readonly Rect[] = [
  { x: 0, y: 500, width: 520, height: 120 },
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
