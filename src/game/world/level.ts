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
// 가짜 안전지대: 발판처럼 보이지만 닿으면 즉시 사망 (docs/traps-spec.md #4)
export const HAZARDS: readonly Rect[] = [{ x: 990, y: 410, width: 80, height: 20 }];
// 낙하하는 발판: 밟으면 유예 시간 후 무너짐 (docs/traps-spec.md #2)
export const FALLING_PLATFORMS: readonly Rect[] = [{ x: 1600, y: 380, width: 100, height: 20 }];
