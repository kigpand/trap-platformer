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
