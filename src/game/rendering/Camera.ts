import { WORLD_WIDTH } from '../world/level';
export function cameraX(playerX: number, viewportWidth: number): number { return Math.max(0, Math.min(WORLD_WIDTH - viewportWidth, playerX - viewportWidth * 0.4)); }
