import { overlaps, type Rect } from '../physics/AABB';
import { createPlayer, GRAVITY, JUMP_SPEED, MAX_FALL_SPEED, SPEED, type Player } from '../entities/Player';
import { moveWithCollisions } from '../physics/Collision';
import { FALLING_PLATFORMS, GOAL, HAZARDS, HIDDEN_BLOCKS, SOLIDS, SPAWN, WORLD_HEIGHT, WORLD_WIDTH } from './level';

const FALL_TRIGGER_DELAY = 0.4; // docs/traps-spec.md #2 유예 시간
const HIDDEN_BLOCK_DELAY = 0.2; // docs/traps-spec.md #1 유예 시간

export interface InputState { horizontal: -1 | 0 | 1; jumpPressed: boolean; restartPressed: boolean }
export interface GameSnapshot { x: number; y: number; grounded: boolean; deaths: number; cleared: boolean }
// 낙하 발판/숨겨진 블록처럼 접촉 후 유예 시간이 지나면 솔리드 속성을 잃는 함정의 공통 상태.
export interface CollapsingSolidState { readonly rect: Rect; solid: boolean; timer: number | null }

function isStandingOn(player: Player, rect: Rect): boolean {
  return player.grounded && player.x < rect.x + rect.width && player.x + player.width > rect.x
    && Math.abs(player.y + player.height - rect.y) < 0.5;
}

function isTouchingSide(player: Player, rect: Rect): boolean {
  const verticalOverlap = player.y < rect.y + rect.height && player.y + player.height > rect.y;
  const touchingLeft = Math.abs(player.x + player.width - rect.x) < 0.5;
  const touchingRight = Math.abs(player.x - (rect.x + rect.width)) < 0.5;
  return verticalOverlap && (touchingLeft || touchingRight);
}

function createCollapsingSolids(rects: readonly Rect[]): CollapsingSolidState[] {
  return rects.map((rect) => ({ rect, solid: true, timer: null }));
}

// 접촉 시 타이머를 시작하고, 유예 시간이 지나면 솔리드 속성을 제거한다. 붕괴 직후 플레이어가
// 그 위에 서 있었다면 grounded도 즉시 false로 되돌려, 사라진 발판에서 점프하는 것을 막는다
// (Codex 리뷰: 붕괴 직후 한 프레임 점프 가능 버그).
function updateCollapsing(state: CollapsingSolidState, player: Player, triggered: boolean, delay: number, dt: number): void {
  if (!state.solid) return;
  if (state.timer === null && triggered) state.timer = delay;
  if (state.timer !== null) {
    state.timer -= dt;
    if (state.timer <= 0) {
      state.solid = false;
      if (isStandingOn(player, state.rect)) player.grounded = false;
    }
  }
}

export class World {
  player: Player = createPlayer(SPAWN.x, SPAWN.y);
  deaths = 0;
  cleared = false;
  fallingPlatforms: CollapsingSolidState[] = createCollapsingSolids(FALLING_PLATFORMS);
  hiddenBlocks: CollapsingSolidState[] = createCollapsingSolids(HIDDEN_BLOCKS);
  reset(countDeath = false): void {
    if (countDeath) this.deaths++;
    this.player = createPlayer(SPAWN.x, SPAWN.y);
    this.cleared = false;
    this.fallingPlatforms = createCollapsingSolids(FALLING_PLATFORMS);
    this.hiddenBlocks = createCollapsingSolids(HIDDEN_BLOCKS);
  }
  update(dt: number, input: InputState): void {
    if (input.restartPressed) { this.reset(); return; }
    const p = this.player;

    // 점프 입력을 확인하기 전에 붕괴를 먼저 처리해, 발판이 사라진 바로 그 프레임부터
    // grounded가 즉시 false가 되도록 한다 (Codex 리뷰: 붕괴 직후 한 프레임 점프 가능 버그).
    for (const fp of this.fallingPlatforms) updateCollapsing(fp, p, isStandingOn(p, fp.rect), FALL_TRIGGER_DELAY, dt);
    for (const hb of this.hiddenBlocks) {
      updateCollapsing(hb, p, isStandingOn(p, hb.rect) || isTouchingSide(p, hb.rect), HIDDEN_BLOCK_DELAY, dt);
    }

    p.vx = input.horizontal * SPEED;
    if (input.jumpPressed && p.grounded) { p.vy = -JUMP_SPEED; p.grounded = false; }
    p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY * dt);
    const collapsing = [...this.fallingPlatforms, ...this.hiddenBlocks].filter((s) => s.solid).map((s) => s.rect);
    const solids = [...SOLIDS, ...collapsing];
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
