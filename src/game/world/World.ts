import { overlaps, type Rect } from '../physics/AABB';
import { createPlayer, GRAVITY, JUMP_SPEED, MAX_FALL_SPEED, SPEED, type Player } from '../entities/Player';
import { createEnemy, updateEnemy, type Enemy } from '../entities/Enemy';
import { moveWithCollisions } from '../physics/Collision';
import {
  AMBUSH_ENEMIES, CONDITIONAL_TRAPS, ENEMIES, FALLING_PLATFORMS, GOAL, HAZARDS, HIDDEN_BLOCKS, SOLIDS, SPAWN,
  WORLD_HEIGHT, WORLD_WIDTH, type AmbushEnemy,
} from './level';

const FALL_TRIGGER_DELAY = 0.4; // docs/traps-spec.md #2 유예 시간
const HIDDEN_BLOCK_DELAY = 0.2; // docs/traps-spec.md #1 유예 시간
const AMBUSH_WARNING_DELAY = 0.3; // docs/traps-spec.md #3 경고 시간
const CONDITIONAL_DWELL_THRESHOLD = 1.0; // docs/traps-spec.md #5 "영역 내 1초 이상 체류"

export interface InputState { horizontal: -1 | 0 | 1; jumpPressed: boolean; restartPressed: boolean }
export interface GameSnapshot { x: number; y: number; grounded: boolean; deaths: number; cleared: boolean }
// 낙하 발판/숨겨진 블록처럼 접촉 후 유예 시간이 지나면 솔리드 속성을 잃는 함정의 공통 상태.
export interface CollapsingSolidState { readonly rect: Rect; solid: boolean; timer: number | null }
// 갑자기 출현하는 적: 트리거 진입 전(enemy=null, warningTimer=null) -> 경고 중(warningTimer 카운트다운)
// -> 등장(enemy 생성, warningTimer=null로 복귀). 등장 후에는 일반 적과 동일하게 behaves.
export interface AmbushState { readonly config: AmbushEnemy; warningTimer: number | null; enemy: Enemy | null }
// 조건부 함정 트리거: 영역에 겹쳐 있는 동안 dwellTime이 누적되고, 벗어나면 0으로 되돌아간다
// ("체류" 조건이므로 연속으로 머물러야 한다). 기준 시간을 넘기면 발동.
export interface ConditionalTrapState { readonly zone: Rect; dwellTime: number }

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

function createEnemies(): Enemy[] {
  return ENEMIES.map((e) => createEnemy(e.minX, e.maxX, e.y));
}

function createAmbushes(): AmbushState[] {
  return AMBUSH_ENEMIES.map((config) => ({ config, warningTimer: null, enemy: null }));
}

function createConditionalTraps(): ConditionalTrapState[] {
  return CONDITIONAL_TRAPS.map((c) => ({ zone: c.zone, dwellTime: 0 }));
}

// 접촉 시 타이머를 시작하고, 유예 시간이 지나면 솔리드 속성을 제거한다.
// grounded 보정은 여기서 하지 않는다 — 플레이어가 다른 솔리드에도 걸쳐 있을 수 있어
// "이 함정 하나"만 보고 지우면 틀릴 수 있다(Codex 리뷰: ground1a와 숨겨진 블록 경계에
// 걸쳐 서 있을 때 블록이 붕괴하면 고정 바닥이 받치고 있어도 점프가 무시되던 버그).
// 대신 모든 붕괴 처리가 끝난 뒤 World.update에서 남아있는 솔리드 전체를 기준으로 한 번에 재확인한다.
function updateCollapsing(state: CollapsingSolidState, triggered: boolean, delay: number, dt: number): void {
  if (!state.solid) return;
  if (state.timer === null && triggered) state.timer = delay;
  if (state.timer !== null) {
    state.timer -= dt;
    if (state.timer <= 0) state.solid = false;
  }
}

export class World {
  player: Player = createPlayer(SPAWN.x, SPAWN.y);
  deaths = 0;
  cleared = false;
  fallingPlatforms: CollapsingSolidState[] = createCollapsingSolids(FALLING_PLATFORMS);
  hiddenBlocks: CollapsingSolidState[] = createCollapsingSolids(HIDDEN_BLOCKS);
  enemies: Enemy[] = createEnemies();
  ambushes: AmbushState[] = createAmbushes();
  conditionalTraps: ConditionalTrapState[] = createConditionalTraps();
  reset(countDeath = false): void {
    if (countDeath) this.deaths++;
    this.player = createPlayer(SPAWN.x, SPAWN.y);
    this.cleared = false;
    this.fallingPlatforms = createCollapsingSolids(FALLING_PLATFORMS);
    this.hiddenBlocks = createCollapsingSolids(HIDDEN_BLOCKS);
    this.enemies = createEnemies();
    this.ambushes = createAmbushes();
    this.conditionalTraps = createConditionalTraps();
  }
  update(dt: number, input: InputState): void {
    if (input.restartPressed) { this.reset(); return; }
    const p = this.player;

    // 점프 입력을 확인하기 전에 붕괴를 먼저 처리하고, 남은 솔리드 기준으로 grounded를
    // 다시 확인해 발판이 사라진 바로 그 프레임부터 정확한 값을 쓰도록 한다
    // (Codex 리뷰: 붕괴 직후 한 프레임 점프 가능 버그).
    for (const fp of this.fallingPlatforms) updateCollapsing(fp, isStandingOn(p, fp.rect), FALL_TRIGGER_DELAY, dt);
    for (const hb of this.hiddenBlocks) {
      updateCollapsing(hb, isStandingOn(p, hb.rect) || isTouchingSide(p, hb.rect), HIDDEN_BLOCK_DELAY, dt);
    }
    // 위에서 무언가 막 사라졌어도 다른 솔리드(예: 인접한 고정 바닥)가 여전히 받치고 있을 수 있다 —
    // 붕괴된 함정 "하나"만 보고 판단하지 않고, 남아있는 솔리드 전체를 기준으로 다시 확인한다.
    if (p.grounded) {
      const stillSupported = SOLIDS.some((s) => isStandingOn(p, s))
        || this.fallingPlatforms.some((fp) => fp.solid && isStandingOn(p, fp.rect))
        || this.hiddenBlocks.some((hb) => hb.solid && isStandingOn(p, hb.rect));
      if (!stillSupported) p.grounded = false;
    }

    p.vx = input.horizontal * SPEED;
    if (input.jumpPressed && p.grounded) { p.vy = -JUMP_SPEED; p.grounded = false; }
    p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY * dt);
    const collapsing = [...this.fallingPlatforms, ...this.hiddenBlocks].filter((s) => s.solid).map((s) => s.rect);
    const solids = [...SOLIDS, ...collapsing];
    moveWithCollisions(p, solids, p.vx * dt, p.vy * dt);
    p.x = Math.max(0, Math.min(WORLD_WIDTH - p.width, p.x));

    for (const e of this.enemies) updateEnemy(e, dt);

    for (const amb of this.ambushes) {
      if (amb.enemy) { updateEnemy(amb.enemy, dt); continue; }
      if (amb.warningTimer === null && overlaps(p, amb.config.trigger)) amb.warningTimer = AMBUSH_WARNING_DELAY;
      if (amb.warningTimer !== null) {
        amb.warningTimer -= dt;
        if (amb.warningTimer <= 0) {
          amb.enemy = createEnemy(amb.config.minX, amb.config.maxX, amb.config.y);
          amb.warningTimer = null;
        }
      }
    }
    const activeEnemies = [...this.enemies, ...this.ambushes.flatMap((a) => (a.enemy ? [a.enemy] : []))];

    for (const ct of this.conditionalTraps) ct.dwellTime = overlaps(p, ct.zone) ? ct.dwellTime + dt : 0;

    if (HAZARDS.some((h) => overlaps(p, h))) { this.reset(true); return; }
    if (activeEnemies.some((e) => overlaps(p, e))) { this.reset(true); return; }
    if (this.conditionalTraps.some((ct) => ct.dwellTime >= CONDITIONAL_DWELL_THRESHOLD)) { this.reset(true); return; }
    if (overlaps(p, GOAL)) this.cleared = true;
    if (p.y > WORLD_HEIGHT + 100) this.reset(true);
  }
  snapshot(): GameSnapshot {
    const p = this.player;
    return { x: Math.round(p.x), y: Math.round(p.y), grounded: p.grounded, deaths: this.deaths, cleared: this.cleared };
  }
}
