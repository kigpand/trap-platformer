import { createPlayer, GRAVITY, JUMP_SPEED, MAX_FALL_SPEED, SPEED, type Player } from '../entities/Player';
import { moveWithCollisions } from '../physics/Collision';
import { SOLIDS, SPAWN, WORLD_HEIGHT, WORLD_WIDTH } from './level';

export interface InputState { horizontal: -1 | 0 | 1; jumpPressed: boolean; restartPressed: boolean }
export interface GameSnapshot { x: number; y: number; grounded: boolean; deaths: number }
export class World {
  player: Player = createPlayer(SPAWN.x, SPAWN.y);
  deaths = 0;
  reset(countDeath = false): void { if (countDeath) this.deaths++; this.player = createPlayer(SPAWN.x, SPAWN.y); }
  update(dt: number, input: InputState): void {
    if (input.restartPressed) { this.reset(); return; }
    const p = this.player;
    p.vx = input.horizontal * SPEED;
    if (input.jumpPressed && p.grounded) { p.vy = -JUMP_SPEED; p.grounded = false; }
    p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY * dt);
    moveWithCollisions(p, SOLIDS, p.vx * dt, p.vy * dt);
    p.x = Math.max(0, Math.min(WORLD_WIDTH - p.width, p.x));
    if (p.y > WORLD_HEIGHT + 100) this.reset(true);
  }
  snapshot(): GameSnapshot { const p = this.player; return { x: Math.round(p.x), y: Math.round(p.y), grounded: p.grounded, deaths: this.deaths }; }
}
