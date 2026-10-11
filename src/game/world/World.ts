import { overlaps, type Rect } from '../physics/AABB';
import { createPlayer, GRAVITY, JUMP_SPEED, MAX_FALL_SPEED, SPEED, type Player } from '../entities/Player';
import { moveWithCollisions } from '../physics/Collision';
import { FALLING_PLATFORMS, GOAL, HAZARDS, SOLIDS, SPAWN, WORLD_HEIGHT, WORLD_WIDTH } from './level';

const FALL_TRIGGER_DELAY = 0.4; // docs/traps-spec.md #2 유예 시간

export interface InputState { horizontal: -1 | 0 | 1; jumpPressed: boolean; restartPressed: boolean }
export interface GameSnapshot { x: number; y: number; grounded: boolean; deaths: number; cleared: boolean }
export interface FallingPlatformState { readonly rect: Rect; solid: boolean; timer: number | null }

function isStandingOn(player: Player, rect: Rect): boolean {
  return player.grounded && player.x < rect.x + rect.width && player.x + player.width > rect.x
    && Math.abs(player.y + player.height - rect.y) < 0.5;
}

function createFallingPlatforms(): FallingPlatformState[] {
  return FALLING_PLATFORMS.map((rect) => ({ rect, solid: true, timer: null }));
}

export class World {
  player: Player = createPlayer(SPAWN.x, SPAWN.y);
  deaths = 0;
  cleared = false;
  fallingPlatforms: FallingPlatformState[] = createFallingPlatforms();
  reset(countDeath = false): void {
    if (countDeath) this.deaths++;
    this.player = createPlayer(SPAWN.x, SPAWN.y);
    this.cleared = false;
    this.fallingPlatforms = createFallingPlatforms();
  }
  update(dt: number, input: InputState): void {
    if (input.restartPressed) { this.reset(); return; }
    const p = this.player;

    // 점프 입력을 확인하기 전에 붕괴를 먼저 처리해, 발판이 사라진 바로 그 프레임부터
    // grounded가 즉시 false가 되도록 한다 (Codex 리뷰: 붕괴 직후 한 프레임 점프 가능 버그).
    for (const fp of this.fallingPlatforms) {
      if (!fp.solid) continue;
      if (fp.timer === null && isStandingOn(p, fp.rect)) fp.timer = FALL_TRIGGER_DELAY;
      if (fp.timer !== null) {
        fp.timer -= dt;
        if (fp.timer <= 0) {
          fp.solid = false;
          if (isStandingOn(p, fp.rect)) p.grounded = false;
        }
      }
    }

    p.vx = input.horizontal * SPEED;
    if (input.jumpPressed && p.grounded) { p.vy = -JUMP_SPEED; p.grounded = false; }
    p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY * dt);
    const solids = [...SOLIDS, ...this.fallingPlatforms.filter((fp) => fp.solid).map((fp) => fp.rect)];
    moveWithCollisions(p, solids, p.vx * dt, p.vy * dt);
    p.x = Math.max(0, Math.min(WORLD_WIDTH - p.width, p.x));

    if (HAZARDS.some((h) => overlaps(p, h))) { this.reset(true); return; }
    if (overlaps(p, GOAL)) this.cleared = true;
    if (p.y > WORLD_HEIGHT + 100) this.reset(true);
  }
  snapshot(): GameSnapshot {
    const p = this.player;
    return { x: Math.round(p.x), y: Math.round(p.y), grounded: p.grounded, deaths: this.deaths, cleared: this.cleared };
  }
}
