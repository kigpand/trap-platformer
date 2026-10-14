import type { Rect } from '../physics/AABB';

export interface Player extends Rect { vx: number; vy: number; grounded: boolean; facing: 1 | -1 }
export const PLAYER_WIDTH = 26;
export const PLAYER_HEIGHT = 32;
export const SPEED = 210;
export const GRAVITY = 1350;
export const JUMP_SPEED = 480;
export const MAX_FALL_SPEED = 900;
export function createPlayer(x: number, y: number): Player {
  return { x, y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, vx: 0, vy: 0, grounded: false, facing: 1 };
}
