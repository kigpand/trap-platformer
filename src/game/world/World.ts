import { overlaps, type Rect } from '../physics/AABB';
import { createPlayer, GRAVITY, JUMP_SPEED, MAX_FALL_SPEED, SPEED, type Player } from '../entities/Player';
import { createEnemy, ENEMY_HEIGHT, ENEMY_WIDTH, updateEnemy, type Enemy } from '../entities/Enemy';
import { moveWithCollisions } from '../physics/Collision';
import type { AmbushEnemy, DodgingPlatform, FallingCeiling, Level, PopUpSpike, SkyDrop, SkyDropGroup, SpringFloor } from './level';
import { cameraX, VIEW_WIDTH } from './viewport';

const FALL_TRIGGER_DELAY = 0.4; // docs/traps-spec.md #2 유예 시간
const HIDDEN_BLOCK_DELAY = 0.2; // docs/traps-spec.md #1 유예 시간
const AMBUSH_WARNING_DELAY = 0.3; // docs/traps-spec.md #3 경고 시간
const CONDITIONAL_DWELL_THRESHOLD = 1.0; // docs/traps-spec.md #5 "영역 내 1초 이상 체류"
const DEATH_CAUSE_DURATION = 2.0; // docs/traps-spec.md "사망 원인 표시": 화면에 보이는 동안 2초 강조
const FALL_CAUSE_WINDOW = 3.0; // 낙사형 함정은 사망 직전 3초 안에 마지막으로 발동한 함정을 원인으로 본다
const TAUNT_DURATION = 2.0; // docs/game-design.md "놀리는 사망 메시지": 재시작 직후 2초
const VANISH_TILE = 40; // docs/traps-spec.md #6 칸 너비
const VANISH_SPEED = 150; // #6 붕괴 전선 속도(플레이어 210px/s보다 느림)
const CEILING_DELAY = 0.1; // #9 트리거 후 낙하까지
const DODGE_DURATION = 0.2; // #8 발판이 미끄러지는 시간
const GOAL_HOP_DURATION = 0.25; // #12 목표가 다음 위치로 이동하는 시간
const SKY_DROP_WARNING = 0.4; // #13 경고 시작부터 떨어지기까지

export interface InputState { horizontal: -1 | 0 | 1; jumpPressed: boolean; restartPressed: boolean }
// 효과음 재생을 위해 한 번의 update 동안 일어난 일을 기록한다. World는 소리를 모르고,
// GameController가 drainEvents()로 꺼내 SoundPlayer에 넘긴다.
export type WorldEvent = 'jump' | 'death' | 'checkpoint' | 'clear';
// time은 이번 런의 경과 시간(초, 0.1초 단위 내림). runDeaths는 이번 런의 사망 수 — deaths(FALLS)는 수동 재시작에도 누적된다.
// deathKind는 가장 최근 사망의 원인 종류(원인 없는 낙사·수동 재시작 뒤에는 null) — 스크린 리더 사망 알림에 놀리는 문구를 붙인다.
export interface GameSnapshot {
  x: number; y: number; grounded: boolean; deaths: number; cleared: boolean; checkpoint: boolean; time: number; runDeaths: number;
  deathKind: DeathCauseKind | null;
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

// #6 사라지는 땅: 밟는 순간(elapsed = 0) 구간 시작점에서 전선이 출발하고, i번째 칸은
// elapsed ≥ (i + 1) × 40 / 150초에 통째로 사라진다. tilesGone은 앞에서부터 사라진 칸 수.
export interface VanishingGroundState { readonly rect: Rect; elapsed: number | null; tilesGone: number }
// #7 투명 블록: 위로 이동 중에 아랫면에 닿으면 visible이 되고, 그때부터 일반 솔리드다.
export interface InvisibleBlockState { readonly rect: Rect; visible: boolean }
// #9 떨어지는 천장: idle(솔리드) → armed(트리거 후 0.1초) → falling(솔리드 아님, 닿으면 즉사) → landed(솔리드 장애물).
// 구덩이로 떨어지면 gone.
export interface FallingCeilingState {
  readonly config: FallingCeiling; y: number; vy: number; phase: 'idle' | 'armed' | 'falling' | 'landed' | 'gone'; timer: number;
}

// #8 도망가는 발판: idle → moving(0.2초 동안 to로 선형 이동) → moved. 언제나 현재 위치의 솔리드다.
export interface DodgingPlatformState { readonly config: DodgingPlatform; x: number; y: number; elapsed: number | null }
// #10 솟아오르는 가시: 한 번 솟으면 그 목숨 동안 유지된다.
export interface PopUpSpikeState { readonly config: PopUpSpike; raised: boolean }
// #12 도망가는 목표: 현재 목표 위치와, 이동 중이면 출발·도착과 경과 시간. hopIndex는 다음에 쓸 goalHops 번호.
export interface GoalState { rect: Rect; hopIndex: number; move: { from: Rect; to: Rect; elapsed: number } | null }

// #13 하늘에서 쏟아지는 적. 그룹은 트리거 진입 뒤 경과 시간(elapsed)을 세고, 적마다
// idle → warning(delay부터 0.4초) → falling(중력) → patrolling(착지 후 일반 적처럼 왕복) 또는 gone(구덩이 아래).
// 중력은 이 적의 등장 단계에만 있다 — 일반 왕복 적·갑자기 출현하는 적에는 없다(traps-spec "적 충돌 규칙").
export interface SkyDropEnemyState { readonly drop: SkyDrop; phase: 'idle' | 'warning' | 'falling' | 'patrolling' | 'gone'; enemy: Enemy | null; vy: number }
export interface SkyDropGroupState { readonly config: SkyDropGroup; elapsed: number | null; readonly enemies: SkyDropEnemyState[] }

export function vanishingTileCount(rect: Rect): number { return Math.ceil(rect.width / VANISH_TILE); }
export function vanishingTile(rect: Rect, i: number): Rect {
  return { x: rect.x + i * VANISH_TILE, y: rect.y, width: Math.min(VANISH_TILE, rect.width - i * VANISH_TILE), height: rect.height };
}
export function ceilingRect(c: FallingCeilingState): Rect { return { ...c.config.block, y: c.y }; }

export function dodgingRect(d: DodgingPlatformState): Rect { return { ...d.config.platform, x: d.x, y: d.y }; }
function createDodgingPlatforms(level: Level): DodgingPlatformState[] {
  return level.dodgingPlatforms.map((config) => ({ config, x: config.platform.x, y: config.platform.y, elapsed: null }));
}
function createPopUpSpikes(level: Level): PopUpSpikeState[] {
  return level.popUpSpikes.map((config) => ({ config, raised: false }));
}
function createGoal(level: Level): GoalState { return { rect: level.goal, hopIndex: 0, move: null }; }
function createSkyDrops(level: Level): SkyDropGroupState[] {
  return level.skyDrops.map((config) => ({
    config, elapsed: null, enemies: config.drops.map((drop) => ({ drop, phase: 'idle', enemy: null, vy: 0 })),
  }));
}
// 사망 원인 표시 영역: 움직이는 적 대신 트리거와 떨어지는 x 위치들(트리거 높이만큼)을 합친 영역.
function skyDropArea(group: SkyDropGroup): Rect {
  return group.drops.reduce<Rect>((area, d) => union(area, { x: d.x, y: group.trigger.y, width: ENEMY_WIDTH, height: group.trigger.height }), group.trigger);
}

// #17 뒷걸음 스프링 바닥: 한 번 튕긴 뒤에는 그 목숨 동안 눌린 스프링 모양으로 그린다(bounced).
export interface SpringFloorState { readonly config: SpringFloor; bounced: boolean }
function createSpringFloors(level: Level): SpringFloorState[] {
  return level.springFloors.map((config) => ({ config, bounced: false }));
}
// 강제 비행(#15·#17 공통): 비행 중에는 좌우 입력 대신 vx를 넣는다. launched는 발동한 스텝 표시 — 그 스텝은 착지로 보지 않는다.
export interface ForcedFlightState { readonly vx: number; launched: boolean }
// #16 좌우 반전: 걸린 구역과 들어온 쪽. 들어온 쪽의 반대편으로 구역을 완전히 빠져나가야 풀린다.
export interface ReverseState { readonly zone: Rect; readonly enteredFrom: 'left' | 'right' }

function createVanishingGrounds(level: Level): VanishingGroundState[] {
  return level.vanishingGrounds.map((rect) => ({ rect, elapsed: null, tilesGone: 0 }));
}
function createInvisibleBlocks(level: Level): InvisibleBlockState[] {
  return level.invisibleBlocks.map((rect) => ({ rect, visible: false }));
}
function createFallingCeilings(level: Level): FallingCeilingState[] {
  return level.fallingCeilings.map((config) => ({ config, y: config.block.y, vy: 0, phase: 'idle', timer: 0 }));
}

// 함정으로 사망한 직후, 원인이 된 함정의 영역을 강조 표시하는 상태(docs/traps-spec.md "공통 규칙"의 사망 원인 표시).
// remaining은 update(고정 스텝)에서, 그리고 그 영역이 화면에 보이는 동안에만 줄어든다 — 일시정지 중이나
// 체크포인트 없이 먼 시작점에서 재시작해 영역이 화면 밖에 있을 때는 플레이어가 볼 때까지 남는다.
// 사망 원인의 종류. 놀리는 사망 메시지(docs/game-design.md)를 고르는 데 쓴다 — 문구 자체는 렌더링 쪽(rendering/taunts.ts)에 있다.
export type DeathCauseKind =
  | 'hiddenBlock' | 'fallingPlatform' | 'ambush' | 'hazard' | 'conditional' | 'enemy'
  | 'vanishingGround' | 'invisibleBlock' | 'dodgingPlatform' | 'fallingCeiling' | 'popUpSpikes'
  | 'fakeCheckpoint' | 'fleeingGoal' | 'skyDrop' | 'flingJump' | 'reverseZone';
// 놀리는 문구의 종류: 사망 원인 + 죽지 않는 17번 스프링 바닥(튕겨 날아갈 때 같은 자리에 띄운다).
export type TauntKind = DeathCauseKind | 'springFloor';
export interface DeathCause { readonly rect: Rect; readonly kind: DeathCauseKind }
export interface DeathCauseState { readonly rect: Rect; readonly kind: DeathCauseKind; remaining: number }

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
  vanishingGrounds: VanishingGroundState[];
  invisibleBlocks: InvisibleBlockState[];
  fallingCeilings: FallingCeilingState[];
  dodgingPlatforms: DodgingPlatformState[];
  popUpSpikes: PopUpSpikeState[];
  goal: GoalState;
  skyDrops: SkyDropGroupState[];
  springFloors: SpringFloorState[];
  flight: ForcedFlightState | null = null;
  reverse: ReverseState | null = null;
  activeCheckpoint: { x: number; y: number } | null = null;
  deathCause: DeathCauseState | null = null;
  // 낙사형 함정(1·2번)이 마지막으로 발동한 영역과 시각(clock). 3초 안에 낙사하면 이것을 원인으로 표시한다.
  private lastFallTrap: { cause: DeathCause; at: number } | null = null;
  // 놀리는 사망 메시지: 원인이 있는 사망 직후 2초(고정 스텝에서만 감소). lastDeathKind는 스냅샷용으로 다음 사망까지 남긴다.
  taunt: { readonly kind: TauntKind; remaining: number } | null = null;
  private lastDeathKind: DeathCauseKind | null = null;
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
    this.vanishingGrounds = createVanishingGrounds(level);
    this.invisibleBlocks = createInvisibleBlocks(level);
    this.fallingCeilings = createFallingCeilings(level);
    this.dodgingPlatforms = createDodgingPlatforms(level);
    this.popUpSpikes = createPopUpSpikes(level);
    this.goal = createGoal(level);
    this.skyDrops = createSkyDrops(level);
    this.springFloors = createSpringFloors(level);
  }
  // 함정이 만들고 없애는 솔리드(레벨의 고정 바닥 제외). 플레이어 충돌·지지 재확인·떨어지는 천장 착지가 같은 목록을 쓴다.
  dynamicSolids(exclude?: FallingCeilingState): Rect[] {
    const rects: Rect[] = [];
    for (const s of [...this.fallingPlatforms, ...this.hiddenBlocks]) if (s.solid) rects.push(s.rect);
    for (const vg of this.vanishingGrounds) {
      for (let i = vg.tilesGone; i < vanishingTileCount(vg.rect); i++) rects.push(vanishingTile(vg.rect, i));
    }
    for (const ib of this.invisibleBlocks) if (ib.visible) rects.push(ib.rect);
    for (const c of this.fallingCeilings) if (c !== exclude && (c.phase === 'idle' || c.phase === 'armed' || c.phase === 'landed')) rects.push(ceilingRect(c));
    for (const d of this.dodgingPlatforms) rects.push(dodgingRect(d));
    return rects;
  }
  drainEvents(): WorldEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }
  // cause: 이 사망의 원인(영역과 종류, 없으면 표시하지 않음). 수동 재시작(R)은 원인 없이 부른다.
  reset(countDeath = false, cause: DeathCause | null = null): void {
    if (countDeath) {
      this.deaths++; this.events.push('death');
      if (!this.runComplete) this.runDeaths++;
    } else {
      this.activeCheckpoint = null; // 수동 재시작(R)은 체크포인트 진행도도 초기화한다
      this.runTime = 0; this.runDeaths = 0; this.runComplete = false;
    }
    this.deathCause = cause ? { rect: cause.rect, kind: cause.kind, remaining: DEATH_CAUSE_DURATION } : null; // 이전 표시는 항상 새 사망(또는 R)으로 대체된다
    this.taunt = cause ? { kind: cause.kind, remaining: TAUNT_DURATION } : null;
    this.lastDeathKind = countDeath ? cause?.kind ?? null : null;
    this.lastFallTrap = null;
    const spawn = countDeath && this.activeCheckpoint ? this.activeCheckpoint : this.level.spawn;
    this.player = createPlayer(spawn.x, spawn.y);
    this.cleared = false;
    this.fallingPlatforms = createCollapsingSolids(this.level.fallingPlatforms);
    this.hiddenBlocks = createCollapsingSolids(this.level.hiddenBlocks);
    this.enemies = createEnemies(this.level);
    this.ambushes = createAmbushes(this.level);
    this.conditionalTraps = createConditionalTraps(this.level);
    this.vanishingGrounds = createVanishingGrounds(this.level);
    this.invisibleBlocks = createInvisibleBlocks(this.level);
    this.fallingCeilings = createFallingCeilings(this.level);
    this.dodgingPlatforms = createDodgingPlatforms(this.level);
    this.popUpSpikes = createPopUpSpikes(this.level);
    this.goal = createGoal(this.level);
    this.skyDrops = createSkyDrops(this.level);
    this.springFloors = createSpringFloors(this.level);
    this.flight = null;
    this.reverse = null;
  }
  update(dt: number, input: InputState): void {
    if (input.restartPressed) { this.reset(); return; }
    if (!this.runComplete) this.runTime += dt;
    this.clock += dt;
    if (this.taunt) {
      this.taunt.remaining -= dt;
      if (this.taunt.remaining <= 1e-6) this.taunt = null;
    }
    if (this.deathCause && isOnScreen(this.deathCause.rect, this.player.x, this.level.width)) {
      this.deathCause.remaining -= dt;
      if (this.deathCause.remaining <= 1e-6) this.deathCause = null; // 1/60 누적 오차로 120스텝 뒤에도 0보다 조금 크게 남지 않게
    }
    const p = this.player;

    // 점프 입력을 확인하기 전에 붕괴를 먼저 처리하고, 남은 솔리드 기준으로 grounded를
    // 다시 확인해 발판이 사라진 바로 그 프레임부터 정확한 값을 쓰도록 한다
    // (Codex 리뷰: 붕괴 직후 한 프레임 점프 가능 버그).
    for (const fp of this.fallingPlatforms) {
      if (updateCollapsing(fp, isStandingOn(p, fp.rect), FALL_TRIGGER_DELAY, dt)) this.lastFallTrap = { cause: { rect: fp.rect, kind: 'fallingPlatform' }, at: this.clock };
    }
    for (const hb of this.hiddenBlocks) {
      const triggered = isStandingOn(p, hb.rect) || isTouchingSide(p, hb.rect);
      if (updateCollapsing(hb, triggered, HIDDEN_BLOCK_DELAY, dt)) this.lastFallTrap = { cause: { rect: hb.rect, kind: 'hiddenBlock' }, at: this.clock };
    }
    for (const vg of this.vanishingGrounds) {
      if (vg.elapsed === null) {
        if (!isStandingOn(p, vg.rect)) continue;
        vg.elapsed = 0;
      }
      vg.elapsed += dt;
      const gone = Math.min(vanishingTileCount(vg.rect), Math.floor((vg.elapsed * VANISH_SPEED) / VANISH_TILE + 1e-6));
      if (gone > vg.tilesGone) { vg.tilesGone = gone; this.lastFallTrap = { cause: { rect: vg.rect, kind: 'vanishingGround' }, at: this.clock }; }
    }
    // 위에서 무언가 막 사라졌어도 다른 솔리드(예: 인접한 고정 바닥)가 여전히 받치고 있을 수 있다 —
    // 붕괴된 함정 "하나"만 보고 판단하지 않고, 남아있는 솔리드 전체를 기준으로 다시 확인한다.
    if (p.grounded) {
      const stillSupported = [...this.level.solids, ...this.dynamicSolids()].some((s) => isStandingOn(p, s));
      if (!stillSupported) p.grounded = false;
    }

    // #17 스프링 바닥: 타일 위에 서 있으면 강제 비행으로 튕긴다(죽지 않으므로 사망 원인 대신 놀리는 문구만 띄운다).
    if (!this.flight) {
      const spring = this.springFloors.find((sf) => isStandingOn(p, sf.config.tile));
      if (spring) {
        spring.bounced = true;
        this.launch(spring.config.vx, spring.config.vy);
        this.taunt = { kind: 'springFloor', remaining: TAUNT_DURATION };
      }
    }
    // #16 좌우 반전은 공중에서도 걸려 있다. 강제 비행 중에는 어차피 좌우 입력을 쓰지 않는다.
    const horizontal = this.reverse ? -input.horizontal as -1 | 0 | 1 : input.horizontal;
    if (this.flight) p.vx = this.flight.vx;
    else {
      p.vx = horizontal * SPEED;
      if (horizontal !== 0) p.facing = horizontal;
    }
    if (input.jumpPressed && p.grounded) {
      // #15 날려버리는 점프: 구역 안에서 바닥에 선 채 뛰면 보통 점프 대신 강제 비행.
      const fling = this.level.flingZones.find((f) => overlaps(p, f.zone));
      if (fling) {
        this.launch(fling.vx, fling.vy);
        this.lastFallTrap = { cause: { rect: fling.zone, kind: 'flingJump' }, at: this.clock };
      } else { p.vy = -JUMP_SPEED; p.grounded = false; }
      this.events.push('jump');
    }
    p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY * dt);
    // #7 투명 블록: 이번 이동으로 머리가 아랫면을 지나가면(위로 이동 중, 블록 아래에서 출발) 나타나 솔리드가 된다.
    // 수평 겹침은 머리가 아랫면 높이에 닿는 바로 그 순간의 x로 판정한다 — 이동 후 x로 보면, 옆에서 대각선으로
    // 올라오다 아랫면 높이를 지난 뒤에야 수평으로 겹치는 경우를 아래에서 찧은 것으로 오인한다(Codex 리뷰).
    // 옆이나 위에서 닿는 경우는 여기 걸리지 않고, 보이지 않는 동안은 솔리드 목록에 없어 그대로 통과한다.
    if (p.vy < 0) {
      const dy = p.vy * dt;
      for (const ib of this.invisibleBlocks) {
        if (ib.visible) continue;
        const bottom = ib.rect.y + ib.rect.height;
        if (p.y < bottom - 0.5 || p.y + dy >= bottom) continue; // 이번 스텝에 아래에서 아랫면 높이를 지나지 않는다
        const t = Math.min(1, Math.max(0, (bottom - p.y) / dy)); // 아랫면 높이에 닿는 시점(스텝 내 비율)
        const xAtContact = p.x + p.vx * dt * t;
        if (xAtContact < ib.rect.x + ib.rect.width && xAtContact + p.width > ib.rect.x) {
          ib.visible = true; this.lastFallTrap = { cause: { rect: ib.rect, kind: 'invisibleBlock' }, at: this.clock };
        }
      }
    }
    const solids = [...this.level.solids, ...this.dynamicSolids()];
    const wasAirborne = !p.grounded; // 이동 전 공중 여부 — 이번 스텝에 착지해도 "공중에서 들어온 것"으로 본다(#8)
    moveWithCollisions(p, solids, p.vx * dt, p.vy * dt);
    p.x = Math.max(0, Math.min(this.level.width - p.width, p.x));
    // 강제 비행은 발동한 다음 스텝부터, 이동 뒤 grounded가 된 첫 스텝(착지)에서 끝난다. 천장 충돌은 grounded가 아니다.
    if (this.flight) {
      if (!this.flight.launched && p.grounded) this.flight = null;
      else this.flight.launched = false;
    }
    this.updateReverse();

    for (const e of this.enemies) updateEnemy(e, dt);

    // #8 도망가는 발판: 공중에서 트리거에 들어오면 한 번만 미끄러진다. 3초 안의 낙사는 발판의 원래 위치를 원인으로 본다.
    // 공중 여부는 이동 전·후 둘 중 하나라도 공중이면 참이다 — 이동 뒤 grounded만 보면 착지하는 바로 그 스텝에
    // 처음 트리거에 들어온 경우를 놓친다(Codex 리뷰).
    for (const d of this.dodgingPlatforms) {
      if (d.elapsed === null) {
        if ((!wasAirborne && p.grounded) || !overlaps(p, d.config.trigger)) continue;
        d.elapsed = 0;
        this.lastFallTrap = { cause: { rect: d.config.platform, kind: 'dodgingPlatform' }, at: this.clock };
      }
      if (d.elapsed >= DODGE_DURATION) continue;
      d.elapsed = d.elapsed + dt >= DODGE_DURATION - 1e-6 ? DODGE_DURATION : d.elapsed + dt; // 1/60 누적 오차로 한 스텝 늦지 않게
      const k = d.elapsed / DODGE_DURATION;
      d.x = d.config.platform.x + (d.config.to.x - d.config.platform.x) * k;
      d.y = d.config.platform.y + (d.config.to.y - d.config.platform.y) * k;
    }
    // #10 솟아오르는 가시: 트리거에 들어오면 즉시 솟는다.
    for (const sp of this.popUpSpikes) if (!sp.raised && overlaps(p, sp.config.trigger)) sp.raised = true;
    // #12 도망가는 목표: 다음 트리거에 들어오면 0.25초 동안 다음 위치로 이동한다(이동 중에는 클리어 판정 없음).
    // 트리거한 스텝부터 이동을 시작해 15스텝째에 도착한다(Codex 리뷰: 트리거 스텝을 건너뛰어 16스텝이 걸렸다).
    const g = this.goal;
    if (!g.move && g.hopIndex < this.level.goalHops.length && !this.cleared) {
      const hop = this.level.goalHops[g.hopIndex];
      if (overlaps(p, hop.trigger)) {
        g.move = { from: g.rect, to: hop.to, elapsed: 0 };
        g.hopIndex++;
        this.lastFallTrap = { cause: { rect: union(hop.trigger, hop.to), kind: 'fleeingGoal' }, at: this.clock };
      }
    }
    if (g.move) {
      g.move.elapsed += dt;
      if (g.move.elapsed >= GOAL_HOP_DURATION - 1e-6) { g.rect = g.move.to; g.move = null; }
      else {
        const k = g.move.elapsed / GOAL_HOP_DURATION;
        g.rect = { ...g.move.to, x: g.move.from.x + (g.move.to.x - g.move.from.x) * k, y: g.move.from.y + (g.move.to.y - g.move.from.y) * k };
      }
    }

    // #13 하늘에서 쏟아지는 적: 트리거 스텝부터 시간을 세고(다른 함정과 같이 그 스텝도 포함), 적마다 delay가 지나면
    // 경고, 경고 0.4초 뒤 화면 맨 위 바깥(y = -적 높이)에서 생성해 떨어뜨린다. 착지 판정은 플레이어와 같은 솔리드 목록을 쓴다.
    for (const g of this.skyDrops) {
      if (g.elapsed === null) {
        if (!overlaps(p, g.config.trigger)) continue;
        g.elapsed = 0;
      }
      g.elapsed += dt;
      for (const se of g.enemies) {
        if (se.phase === 'idle' && g.elapsed >= se.drop.delay - 1e-6) se.phase = 'warning';
        if (se.phase === 'warning' && g.elapsed >= se.drop.delay + SKY_DROP_WARNING - 1e-6) {
          se.enemy = { ...createEnemy(se.drop.minX, se.drop.maxX, -ENEMY_HEIGHT), x: se.drop.x };
          se.phase = 'falling';
          se.vy = 0;
          continue; // 생성된 스텝에는 화면 위 바깥에 둔다
        }
        const e = se.enemy;
        if (!e) continue;
        if (se.phase === 'falling') {
          se.vy = Math.min(MAX_FALL_SPEED, se.vy + GRAVITY * dt);
          e.y += se.vy * dt;
          const ground = [...this.level.solids, ...this.dynamicSolids()].find((s) => overlaps(e, s));
          if (ground) { e.y = ground.y - e.height; se.phase = 'patrolling'; }
          else if (e.y > this.level.height + 100) { se.phase = 'gone'; se.enemy = null; }
        } else if (se.phase === 'patrolling') updateEnemy(e, dt);
      }
    }

    // #9 떨어지는 천장: 떨어지는 중 플레이어와 겹치면 깔림(착지 판정보다 먼저 확인해 서 있는 플레이어 위로 떨어져도 깔린다).
    let crushedBy: FallingCeilingState | null = null;
    for (const c of this.fallingCeilings) {
      if (c.phase === 'idle' && overlaps(p, c.config.trigger)) { c.phase = 'armed'; c.timer = CEILING_DELAY; }
      if (c.phase === 'armed') {
        c.timer -= dt;
        if (c.timer <= 1e-6) c.phase = 'falling'; // 0.1 − 6 × (1/60)이 부동소수 오차로 0보다 조금 크게 남아 한 프레임 늦어지지 않게
      }
      if (c.phase !== 'falling') continue;
      c.vy = Math.min(MAX_FALL_SPEED, c.vy + GRAVITY * dt);
      c.y += c.vy * dt;
      if (overlaps(p, ceilingRect(c))) crushedBy = c;
      const ground = [...this.level.solids, ...this.dynamicSolids(c)].find((s) => overlaps(ceilingRect(c), s));
      if (ground) { c.y = ground.y - c.config.block.height; c.vy = 0; c.phase = 'landed'; }
      else if (c.y > this.level.height + 100) c.phase = 'gone';
    }

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

    // 가짜 체크포인트(#11)에 닿은 스텝에는 진짜 체크포인트도 저장하지 않는다 — 사망 판정보다 저장이 먼저라
    // 둘이 겹치면 진짜를 저장한 뒤 죽어, 가짜에 당하고도 진행이 저장됐다(Codex 리뷰).
    const touchingFake = this.level.fakeCheckpoints.some((zone) => overlaps(p, zone));
    for (const cp of this.level.checkpoints) {
      if (touchingFake || !overlaps(p, cp.zone)) continue;
      const current = this.activeCheckpoint;
      if (current?.x !== cp.respawnX || current.y !== cp.respawnY) this.events.push('checkpoint'); // 새로 활성화될 때만
      this.activeCheckpoint = { x: cp.respawnX, y: cp.respawnY };
    }

    if (crushedBy) { this.reset(true, { rect: crushedBy.config.block, kind: 'fallingCeiling' }); return; }
    const hazard = this.level.hazards.find((h) => overlaps(p, h));
    if (hazard) { this.reset(true, { rect: hazard, kind: 'hazard' }); return; }
    const spike = this.popUpSpikes.find((sp) => sp.raised && overlaps(p, sp.config.spikes));
    if (spike) { this.reset(true, { rect: spike.config.spikes, kind: 'popUpSpikes' }); return; }
    const fakeCheckpoint = this.level.fakeCheckpoints.find((zone) => overlaps(p, zone));
    if (fakeCheckpoint) { this.reset(true, { rect: fakeCheckpoint, kind: 'fakeCheckpoint' }); return; }
    const enemy = this.enemies.find((e) => overlaps(p, e));
    if (enemy) { this.reset(true, { rect: patrolArea(enemy), kind: 'enemy' }); return; }
    const skyGroup = this.skyDrops.find((g) => g.enemies.some((se) => se.enemy && overlaps(p, se.enemy)));
    if (skyGroup) { this.reset(true, { rect: skyDropArea(skyGroup.config), kind: 'skyDrop' }); return; }
    const ambush = this.ambushes.find((a) => a.enemy && overlaps(p, a.enemy));
    if (ambush?.enemy) { this.reset(true, { rect: union(ambush.config.trigger, patrolArea(ambush.enemy)), kind: 'ambush' }); return; }
    const conditional = this.conditionalTraps.find((ct) => ct.dwellTime >= CONDITIONAL_DWELL_THRESHOLD);
    if (conditional) { this.reset(true, { rect: conditional.zone, kind: 'conditional' }); return; }
    if (!this.goal.move && overlaps(p, this.goal.rect) && !this.cleared) { this.cleared = true; this.runComplete = true; this.events.push('clear'); }
    if (p.y > this.level.height + 100) {
      // 그냥 구덩이에 빠진 낙사는 표시하지 않고, 직전 3초 안에 무너진 함정이 있으면 그것을 원인으로 본다.
      const fallTrap = this.lastFallTrap && this.clock - this.lastFallTrap.at <= FALL_CAUSE_WINDOW ? this.lastFallTrap.cause : null;
      this.reset(true, fallTrap);
    }
  }
  // 강제 비행 발동: 이번 스텝의 속도를 (vx, vy)로 바꾸고 grounded를 해제한다.
  private launch(vx: number, vy: number): void {
    const p = this.player;
    p.vx = vx; p.vy = vy; p.grounded = false;
    if (vx !== 0) p.facing = vx > 0 ? 1 : -1;
    this.flight = { vx, launched: true };
  }
  // #16 이동을 마친 위치로 반전 걸림·풀림을 정한다(다음 스텝의 입력부터 적용). 처음 겹친 순간 플레이어 중심이
  // 구역 중심보다 왼쪽이면 왼쪽에서 들어온 것으로 본다. 걸려 있는 동안에는 반전 뒤의 낙사를 이 구역 탓으로 보도록 매 스텝 기록한다.
  private updateReverse(): void {
    const p = this.player;
    if (this.reverse) {
      const { zone, enteredFrom } = this.reverse;
      const exited = enteredFrom === 'left' ? p.x >= zone.x + zone.width : p.x + p.width <= zone.x;
      if (exited) { this.reverse = null; return; }
    } else {
      const zone = this.level.reverseZones.find((z) => overlaps(p, z));
      if (!zone) return;
      this.reverse = { zone, enteredFrom: p.x + p.width / 2 < zone.x + zone.width / 2 ? 'left' : 'right' };
    }
    this.lastFallTrap = { cause: { rect: this.reverse.zone, kind: 'reverseZone' }, at: this.clock };
  }
  snapshot(): GameSnapshot {
    const p = this.player;
    return {
      x: Math.round(p.x), y: Math.round(p.y), grounded: p.grounded, deaths: this.deaths, cleared: this.cleared,
      checkpoint: this.activeCheckpoint !== null,
      time: Math.floor(this.runTime * 10 + 1e-6) / 10, // 1/60 누적 오차로 1.0초가 0.9초로 보이지 않게
      runDeaths: this.runDeaths,
      deathKind: this.lastDeathKind,
    };
  }
}
