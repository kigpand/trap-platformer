import { overlaps, type Rect } from '../physics/AABB';
import { createPlayer, GRAVITY, JUMP_SPEED, MAX_FALL_SPEED, SPEED, type Player } from '../entities/Player';
import { createEnemy, updateEnemy, type Enemy } from '../entities/Enemy';
import { moveWithCollisions } from '../physics/Collision';
import type { AmbushEnemy, Level } from './level';
import { cameraX, VIEW_WIDTH } from './viewport';

const FALL_TRIGGER_DELAY = 0.4; // docs/traps-spec.md #2 유예 시간
const HIDDEN_BLOCK_DELAY = 0.2; // docs/traps-spec.md #1 유예 시간
const AMBUSH_WARNING_DELAY = 0.3; // docs/traps-spec.md #3 경고 시간
const CONDITIONAL_DWELL_THRESHOLD = 1.0; // docs/traps-spec.md #5 "영역 내 1초 이상 체류"
const DEATH_CAUSE_DURATION = 2.0; // docs/traps-spec.md "사망 원인 표시": 화면에 보이는 동안 2초 강조
const FALL_CAUSE_WINDOW = 3.0; // 낙사형 함정은 사망 직전 3초 안에 마지막으로 발동한 함정을 원인으로 본다

export interface InputState { horizontal: -1 | 0 | 1; jumpPressed: boolean; restartPressed: boolean }
// 효과음 재생을 위해 한 번의 update 동안 일어난 일을 기록한다. World는 소리를 모르고,
// GameController가 drainEvents()로 꺼내 SoundPlayer에 넘긴다.
export type WorldEvent = 'jump' | 'death' | 'checkpoint' | 'clear';
// time은 이번 런의 경과 시간(초, 0.1초 단위 내림). runDeaths는 이번 런의 사망 수 — deaths(FALLS)는 수동 재시작에도 누적된다.
export interface GameSnapshot {
  x: number; y: number; grounded: boolean; deaths: number; cleared: boolean; checkpoint: boolean; time: number; runDeaths: number;
}
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

function createEnemies(level: Level): Enemy[] {
  return level.enemies.map((e) => createEnemy(e.minX, e.maxX, e.y));
}

function createAmbushes(level: Level): AmbushState[] {
  return level.ambushes.map((config) => ({ config, warningTimer: null, enemy: null }));
}

function createConditionalTraps(level: Level): ConditionalTrapState[] {
  return level.conditionalTraps.map((c) => ({ zone: c.zone, dwellTime: 0 }));
}

// 접촉 시 타이머를 시작하고, 유예 시간이 지나면 솔리드 속성을 제거한다.
// grounded 보정은 여기서 하지 않는다 — 플레이어가 다른 솔리드에도 걸쳐 있을 수 있어
// "이 함정 하나"만 보고 지우면 틀릴 수 있다(Codex 리뷰: ground1a와 숨겨진 블록 경계에
// 걸쳐 서 있을 때 블록이 붕괴하면 고정 바닥이 받치고 있어도 점프가 무시되던 버그).
// 대신 모든 붕괴 처리가 끝난 뒤 World.update에서 남아있는 솔리드 전체를 기준으로 한 번에 재확인한다.
// 이번 스텝에 무너졌으면 true — 낙사 원인(사망 직전 3초 안에 발동한 함정)을 기록하는 데 쓴다.
function updateCollapsing(state: CollapsingSolidState, triggered: boolean, delay: number, dt: number): boolean {
  if (!state.solid) return false;
  if (state.timer === null && triggered) state.timer = delay;
  if (state.timer !== null) {
    state.timer -= dt;
    if (state.timer <= 0) { state.solid = false; return true; }
  }
  return false;
}

// 함정으로 사망한 직후, 원인이 된 함정의 영역을 강조 표시하는 상태(docs/traps-spec.md "공통 규칙"의 사망 원인 표시).
// remaining은 update(고정 스텝)에서, 그리고 그 영역이 화면에 보이는 동안에만 줄어든다 — 일시정지 중이나
// 체크포인트 없이 먼 시작점에서 재시작해 영역이 화면 밖에 있을 때는 플레이어가 볼 때까지 남는다.
export interface DeathCauseState { readonly rect: Rect; remaining: number }

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

// 움직이는 적은 적 자체 대신 그 적이 다니는 구간을 원인으로 표시한다(재시작하면 적 위치가 초기화되므로).
function patrolArea(e: Enemy): Rect {
  return { x: e.minX, y: e.y, width: e.maxX - e.minX, height: e.height };
}

function isOnScreen(rect: Rect, playerX: number, levelWidth: number): boolean {
  const left = cameraX(playerX, VIEW_WIDTH, levelWidth);
  return rect.x < left + VIEW_WIDTH && rect.x + rect.width > left;
}

export class World {
  player: Player;
  deaths = 0;
  cleared = false;
  fallingPlatforms: CollapsingSolidState[];
  hiddenBlocks: CollapsingSolidState[];
  enemies: Enemy[];
  ambushes: AmbushState[];
  conditionalTraps: ConditionalTrapState[];
  activeCheckpoint: { x: number; y: number } | null = null;
  deathCause: DeathCauseState | null = null;
  // 낙사형 함정(1·2번)이 마지막으로 발동한 영역과 시각(clock). 3초 안에 낙사하면 이것을 원인으로 표시한다.
  private lastFallTrap: { rect: Rect; at: number } | null = null;
  // 런 시간과 달리 클리어 뒤에도 흐르는 시뮬레이션 시계 — 낙사 원인의 3초 판정에만 쓴다.
  private clock = 0;
  // 기록용 "런": 수동 재시작(R)으로만 새로 시작한다. 사망은 체크포인트에서 이어 가므로 런을 끊지 않는다.
  // 시간은 update(고정 스텝)에서만 쌓이므로 일시정지 중에는 흐르지 않는다. 클리어하면 런이 끝나 더 쌓이지 않는다.
  runTime = 0;
  runDeaths = 0;
  private runComplete = false;
  private events: WorldEvent[] = [];
  // 레벨 의존 상태는 필드 초기화식이 아니라 생성자에서 만든다 — 초기화식은 매개변수 속성(this.level)이
  // 할당되기 전에 실행되기 때문이다.
  constructor(readonly level: Level) {
    this.player = createPlayer(level.spawn.x, level.spawn.y);
    this.fallingPlatforms = createCollapsingSolids(level.fallingPlatforms);
    this.hiddenBlocks = createCollapsingSolids(level.hiddenBlocks);
    this.enemies = createEnemies(level);
    this.ambushes = createAmbushes(level);
    this.conditionalTraps = createConditionalTraps(level);
  }
  drainEvents(): WorldEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }
  // cause: 이 사망의 원인 영역(없으면 표시하지 않음). 수동 재시작(R)은 원인 없이 부른다.
  reset(countDeath = false, cause: Rect | null = null): void {
    if (countDeath) {
      this.deaths++; this.events.push('death');
      if (!this.runComplete) this.runDeaths++;
    } else {
      this.activeCheckpoint = null; // 수동 재시작(R)은 체크포인트 진행도도 초기화한다
      this.runTime = 0; this.runDeaths = 0; this.runComplete = false;
    }
    this.deathCause = cause ? { rect: cause, remaining: DEATH_CAUSE_DURATION } : null; // 이전 표시는 항상 새 사망(또는 R)으로 대체된다
    this.lastFallTrap = null;
    const spawn = countDeath && this.activeCheckpoint ? this.activeCheckpoint : this.level.spawn;
    this.player = createPlayer(spawn.x, spawn.y);
    this.cleared = false;
    this.fallingPlatforms = createCollapsingSolids(this.level.fallingPlatforms);
    this.hiddenBlocks = createCollapsingSolids(this.level.hiddenBlocks);
    this.enemies = createEnemies(this.level);
    this.ambushes = createAmbushes(this.level);
    this.conditionalTraps = createConditionalTraps(this.level);
  }
  update(dt: number, input: InputState): void {
    if (input.restartPressed) { this.reset(); return; }
    if (!this.runComplete) this.runTime += dt;
    this.clock += dt;
    if (this.deathCause && isOnScreen(this.deathCause.rect, this.player.x, this.level.width)) {
      this.deathCause.remaining -= dt;
      if (this.deathCause.remaining <= 1e-6) this.deathCause = null; // 1/60 누적 오차로 120스텝 뒤에도 0보다 조금 크게 남지 않게
    }
    const p = this.player;

    // 점프 입력을 확인하기 전에 붕괴를 먼저 처리하고, 남은 솔리드 기준으로 grounded를
    // 다시 확인해 발판이 사라진 바로 그 프레임부터 정확한 값을 쓰도록 한다
    // (Codex 리뷰: 붕괴 직후 한 프레임 점프 가능 버그).
    for (const fp of this.fallingPlatforms) {
      if (updateCollapsing(fp, isStandingOn(p, fp.rect), FALL_TRIGGER_DELAY, dt)) this.lastFallTrap = { rect: fp.rect, at: this.clock };
    }
    for (const hb of this.hiddenBlocks) {
      const triggered = isStandingOn(p, hb.rect) || isTouchingSide(p, hb.rect);
      if (updateCollapsing(hb, triggered, HIDDEN_BLOCK_DELAY, dt)) this.lastFallTrap = { rect: hb.rect, at: this.clock };
    }
    // 위에서 무언가 막 사라졌어도 다른 솔리드(예: 인접한 고정 바닥)가 여전히 받치고 있을 수 있다 —
    // 붕괴된 함정 "하나"만 보고 판단하지 않고, 남아있는 솔리드 전체를 기준으로 다시 확인한다.
    if (p.grounded) {
      const stillSupported = this.level.solids.some((s) => isStandingOn(p, s))
        || this.fallingPlatforms.some((fp) => fp.solid && isStandingOn(p, fp.rect))
        || this.hiddenBlocks.some((hb) => hb.solid && isStandingOn(p, hb.rect));
      if (!stillSupported) p.grounded = false;
    }

    p.vx = input.horizontal * SPEED;
    if (input.horizontal !== 0) p.facing = input.horizontal;
    if (input.jumpPressed && p.grounded) { p.vy = -JUMP_SPEED; p.grounded = false; this.events.push('jump'); }
    p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY * dt);
    const collapsing = [...this.fallingPlatforms, ...this.hiddenBlocks].filter((s) => s.solid).map((s) => s.rect);
    const solids = [...this.level.solids, ...collapsing];
    moveWithCollisions(p, solids, p.vx * dt, p.vy * dt);
    p.x = Math.max(0, Math.min(this.level.width - p.width, p.x));

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

    for (const ct of this.conditionalTraps) ct.dwellTime = overlaps(p, ct.zone) ? ct.dwellTime + dt : 0;

    for (const cp of this.level.checkpoints) {
      if (!overlaps(p, cp.zone)) continue;
      const current = this.activeCheckpoint;
      if (current?.x !== cp.respawnX || current.y !== cp.respawnY) this.events.push('checkpoint'); // 새로 활성화될 때만
      this.activeCheckpoint = { x: cp.respawnX, y: cp.respawnY };
    }

    const hazard = this.level.hazards.find((h) => overlaps(p, h));
    if (hazard) { this.reset(true, hazard); return; }
    const enemy = this.enemies.find((e) => overlaps(p, e));
    if (enemy) { this.reset(true, patrolArea(enemy)); return; }
    const ambush = this.ambushes.find((a) => a.enemy && overlaps(p, a.enemy));
    if (ambush?.enemy) { this.reset(true, union(ambush.config.trigger, patrolArea(ambush.enemy))); return; }
    const conditional = this.conditionalTraps.find((ct) => ct.dwellTime >= CONDITIONAL_DWELL_THRESHOLD);
    if (conditional) { this.reset(true, conditional.zone); return; }
    if (overlaps(p, this.level.goal) && !this.cleared) { this.cleared = true; this.runComplete = true; this.events.push('clear'); }
    if (p.y > this.level.height + 100) {
      // 그냥 구덩이에 빠진 낙사는 표시하지 않고, 직전 3초 안에 무너진 함정이 있으면 그것을 원인으로 본다.
      const fallTrap = this.lastFallTrap && this.clock - this.lastFallTrap.at <= FALL_CAUSE_WINDOW ? this.lastFallTrap.rect : null;
      this.reset(true, fallTrap);
    }
  }
  snapshot(): GameSnapshot {
    const p = this.player;
    return {
      x: Math.round(p.x), y: Math.round(p.y), grounded: p.grounded, deaths: this.deaths, cleared: this.cleared,
      checkpoint: this.activeCheckpoint !== null,
      time: Math.floor(this.runTime * 10 + 1e-6) / 10, // 1/60 누적 오차로 1.0초가 0.9초로 보이지 않게
      runDeaths: this.runDeaths,
    };
  }
}
