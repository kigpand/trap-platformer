import { ENEMY_HEIGHT, ENEMY_WIDTH, type Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { cameraX, VIEW_WIDTH } from '../world/viewport';
import {
  drawPixelSprite, ENEMY_WALK_1, ENEMY_WALK_2, PLAYER_IDLE, PLAYER_JUMP, PLAYER_WALK_1, PLAYER_WALK_2,
} from './Sprites';
import { arrowRect, boulderRect, ceilingRect, descendingRect, gemRect, rhythmPhase, SHADOW_DELAY_STEPS, shadowRect, dodgingRect, vanishingTile, vanishingTileCount, type World } from '../world/World';
import type { Rect } from '../physics/AABB';
import { drawBlock, drawGround } from './terrain';
import { drawFlag, drawGoal, drawSign, drawSpikes, GOAL_FILL } from './props';
export { GOAL_FILL, SPIKE_FILL } from './props';
import { TAUNTS } from './taunts';

export const VIEW_HEIGHT = 540;
const WALK_CYCLE_MS = 160; // 걷기 2프레임 전환 주기 — 렌더링 전용 타이밍(시뮬레이션 상태 아님)

function playerFrame(p: Player) {
  if (!p.grounded) return PLAYER_JUMP;
  if (p.vx === 0) return PLAYER_IDLE;
  return Math.floor(performance.now() / WALK_CYCLE_MS) % 2 === 0 ? PLAYER_WALK_1 : PLAYER_WALK_2;
}

function enemyFrame() {
  return Math.floor(performance.now() / WALK_CYCLE_MS) % 2 === 0 ? ENEMY_WALK_1 : ENEMY_WALK_2;
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
  drawPixelSprite(ctx, enemyFrame(), e.x, e.y, e.width, e.height, e.vx < 0);
}
// game/core가 이 모양으로 넘겨준다(FrameMetrics) — 타입만 필요하므로 core -> rendering
// 의존 방향을 만들지 않게 구조적으로만 맞춘다.
export interface RenderMetrics { fps: number; steps: number }
export const HAZARD_REVEAL_FILL = '#b91c1c';
const HAZARD_REVEAL_TOP = '#fca5a5';
export const DEATH_CAUSE_OVERLAY = 'rgba(185,28,28,0.45)';
const BUILDING_SPACING = 130;
export const VANISH_WARNING_FILL = '#c2622f'; // 다음에 무너질 칸(낙하 발판 경고색과 같은 주황)
export const TAUNT_COLOR = '#fca5a5';
export const SKY_WARNING_FILL = '#facc15'; // 하늘에서 쏟아지는 적의 낙하 경고(갑자기 출현하는 적 경고와 같은 노랑)
const CHECKPOINT_IDLE = '#64748b';
export const SPRING_FILL = '#94a3b8'; // 한 번 튕긴 뒤의 눌린 스프링(#17)
export const REVERSE_MARK = '⇄';
export const HEAVY_MARK = '⤓'; // 무거운 신발 구역 안에 있는 동안 플레이어 위에 띄우는 표시(#24)
export const CRACK_FILL = '#1f2a1a'; // #30 착지할 때마다 하나씩 늘어나는 금
export const ARROW_FILL = '#f8fafc'; // #26 화살
export const ARROW_WARNING_FILL = '#facc15'; // #26 화살이 들어올 화면 가장자리 경고(다른 경고와 같은 노랑)
export const RHYTHM_GHOST = 'rgba(153,197,119,0.18)'; // #27 사라진 박자 발판(다시 나타날 자리)
export const RHYTHM_WARNING_FILL = '#d9f99d'; // #27 사라지기 0.3초 전 깜박임
export const ICE_FILL = '#bae6fd'; // #28 얼음 바닥
const ICE_SHINE = '#f0f9ff';
export const FAKE_WALL_REVEALED = 'rgba(138,109,75,0.35)'; // #20 한 번 겹친 가짜 벽(반투명)
export const GEM_FILL = '#22d3ee'; // #21 미끼 보물
export const GEM_SHINE = '#ecfeff';
export const SHADOW_FILL = 'rgba(91,33,182,0.7)'; // #22 따라오는(충돌하는) 그림자
export const SHADOW_OUTLINE_RGB = '167,139,250'; // #22 충돌 없는 흐린 윤곽(점점 진해짐)
export const BOULDER_FILL = '#78716c'; // #19 따라오는 돌덩이
const BOULDER_SHADE = '#57534e';

// 연출(docs/game-design.md "연출"): 화면 흔들림과 파편은 렌더러만 가진 그림 상태다 — World를 바꾸지 않으므로 같은 입력은
// 연출과 상관없이 같은 결과를 낸다. GameController가 고정 스텝마다 stepEffects로 흘려, 일시정지 중에는 멈춘다.
const SHAKE_DURATION = 0.3; // 초
export const SHAKE_AMPLITUDE = 6; // px
const DEBRIS_PER_RECT = 6;
const DEBRIS_LIFE = 0.6; // 초
const MAX_DEBRIS = 60; // 한꺼번에 많이 무너져도 그리기 양이 늘지 않게
const DEBRIS_SIZE = 6;
export const DEBRIS_FILL = '#4d6343';
interface Debris { x: number; y: number; vx: number; vy: number; life: number }
// 운영체제의 "동작 줄이기"를 켠 사용자에게는 화면을 흔들지 않는다.
const prefersReducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export class CanvasRenderer {
  debug = false;
  private shake = 0; // 남은 흔들림 시간(초)
  private debris: Debris[] = [];
  constructor(private readonly canvas: HTMLCanvasElement, private readonly reducedMotion: () => boolean = prefersReducedMotion) {}
  // 깔림 사망·천장 착지·가짜 클리어 바닥 꺼짐에 0.3초 동안 최대 6px 흔든다(점점 잦아듦).
  shakeScreen(): void {
    if (!this.reducedMotion()) this.shake = SHAKE_DURATION;
  }
  // 사라진 발판·블록·바닥의 윗면에서 작은 조각을 몇 개 떨어뜨린다(그림일 뿐 부딪히지 않는다).
  addDebris(rect: Rect): void {
    for (let i = 0; i < DEBRIS_PER_RECT; i++) {
      this.debris.push({ x: rect.x + ((i + 0.5) * rect.width) / DEBRIS_PER_RECT, y: rect.y, vx: (i - (DEBRIS_PER_RECT - 1) / 2) * 30, vy: -150 - (i % 3) * 40, life: DEBRIS_LIFE });
    }
    if (this.debris.length > MAX_DEBRIS) this.debris.splice(0, this.debris.length - MAX_DEBRIS);
  }
  stepEffects(dt: number): void {
    this.shake = Math.max(0, this.shake - dt);
    for (const d of this.debris) { d.vy += 1350 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; }
    this.debris = this.debris.filter((d) => d.life > 0);
  }
  // 이번 그림의 흔들림 오프셋. 무작위 대신 남은 시간으로 정해 테스트에서 재현된다.
  shakeOffset(): { x: number; y: number } {
    if (this.shake <= 0) return { x: 0, y: 0 };
    const k = this.shake / SHAKE_DURATION;
    return { x: Math.round(SHAKE_AMPLITUDE * k * Math.sin(this.shake * 120)), y: Math.round(SHAKE_AMPLITUDE * k * Math.cos(this.shake * 97)) };
  }
  render(world: World, metrics: RenderMetrics, paused = false): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(VIEW_WIDTH * scale), height = Math.round(VIEW_HEIGHT * scale);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = '#101729'; ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    const level = world.level;
    const cam = cameraX(world.player.x, VIEW_WIDTH, level.width);
    const shake = this.shakeOffset();
    ctx.save(); ctx.translate(-cam + shake.x, shake.y);
    // 화면(카메라 가로 범위)과 겹치는 사각형만 그린다 — 레벨이 길어져도 바닥·함정 타일을 그리는 양이 화면 크기만큼으로 유지된다.
    // 개수가 많고 길이 방향으로 늘어나는 지형 계열에만 쓰고, 몇 개뿐인 적·움직이는 함정은 그대로 그린다.
    const inView = (r: Rect): boolean => r.x < cam + VIEW_WIDTH && r.x + r.width > cam;
    const view = { x: cam, width: VIEW_WIDTH, height: VIEW_HEIGHT }; // 땅·블록 무늬를 그릴 범위(terrain.ts)
    const wave = Math.floor(performance.now() / 400) % 2; // 목표 깃발이 나부끼는 프레임(렌더링 전용 타이밍)
    // 배경 건물: 130px 간격으로 반복하되 카메라에 보이는 것만 그린다 — 레벨이 길어져도 끝까지 이어지고 그리기 양은 같다.
    ctx.fillStyle = '#293b4d';
    const firstBuilding = Math.max(0, Math.floor(cam / BUILDING_SPACING) - 1);
    const lastBuilding = Math.ceil((cam + VIEW_WIDTH) / BUILDING_SPACING);
    for (let i = firstBuilding; i <= lastBuilding; i++) ctx.fillRect(i * BUILDING_SPACING, 390 - (i % 4) * 35, 90, 200);
    for (const p of level.solids) {
      if (!inView(p)) continue;
      drawGround(ctx, p, view);
      if (this.debug) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.width, p.height); }
    }
    for (const h of level.hazards) {
      if (!inView(h)) continue;
      // 평소엔 일반 바닥과 똑같이 그리고, 이 타일로 사망한 직후에만 경고색으로 원인을 드러낸다(traps-spec #4).
      const revealed = world.deathCause?.rect === h;
      if (revealed) {
        ctx.fillStyle = HAZARD_REVEAL_FILL; ctx.fillRect(h.x, h.y, h.width, h.height);
        ctx.fillStyle = HAZARD_REVEAL_TOP; ctx.fillRect(h.x, h.y, h.width, Math.min(8, h.height));
        ctx.strokeStyle = HAZARD_REVEAL_TOP; ctx.lineWidth = 3; ctx.strokeRect(h.x, h.y, h.width, h.height);
      } else drawGround(ctx, h, view);
      if (this.debug) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.strokeRect(h.x, h.y, h.width, h.height); }
    }
    // #6 사라지는 땅: 남은 칸은 일반 바닥처럼, 붕괴가 시작되면 다음에 사라질 칸만 경고색으로.
    for (const vg of world.vanishingGrounds) {
      for (let i = vg.tilesGone; i < vanishingTileCount(vg.rect); i++) {
        const t = vanishingTile(vg.rect, i);
        if (!inView(t)) continue;
        const warning = vg.elapsed !== null && i === vg.tilesGone;
        if (warning) { ctx.fillStyle = VANISH_WARNING_FILL; ctx.fillRect(t.x, t.y, t.width, t.height); }
        else drawGround(ctx, t, view);
      }
      if (this.debug) { ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 2; ctx.strokeRect(vg.rect.x, vg.rect.y, vg.rect.width, vg.rect.height); }
    }
    // #7 투명 블록: 나타나기 전에는 그리지 않는다(디버그 오버레이에서만 외곽선).
    for (const ib of world.invisibleBlocks) {
      if (ib.visible) {
        drawBlock(ctx, ib.rect, view);
      } else if (this.debug) { ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; ctx.strokeRect(ib.rect.x, ib.rect.y, ib.rect.width, ib.rect.height); }
    }
    // #9 떨어지는 천장: 현재 위치에 평범한 블록으로 그린다(트리거 영역은 디버그에서만).
    for (const c of world.fallingCeilings) {
      if (c.phase !== 'gone') {
        const r = ceilingRect(c);
        drawBlock(ctx, r, view);
      }
      if (this.debug) { const t = c.config.trigger; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.strokeRect(t.x, t.y, t.width, t.height); }
    }
    for (const fp of world.fallingPlatforms) {
      if (!fp.solid) continue;
      ctx.fillStyle = fp.timer !== null ? '#c2622f' : '#627e55';
      ctx.fillRect(fp.rect.x, fp.rect.y, fp.rect.width, fp.rect.height);
      if (this.debug) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.strokeRect(fp.rect.x, fp.rect.y, fp.rect.width, fp.rect.height); }
    }
    for (const hb of world.hiddenBlocks) {
      if (!hb.solid) continue;
      drawGround(ctx, hb.rect, view);
      if (this.debug) { ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; ctx.strokeRect(hb.rect.x, hb.rect.y, hb.rect.width, hb.rect.height); }
    }
    for (const ct of world.conditionalTraps) {
      ctx.fillStyle = 'rgba(248,113,113,0.15)';
      ctx.fillRect(ct.zone.x, ct.zone.y, ct.zone.width, ct.zone.height);
      if (Math.floor(performance.now() / 150) % 2 === 0) {
        ctx.strokeStyle = '#f87171'; ctx.lineWidth = 3;
        ctx.strokeRect(ct.zone.x, ct.zone.y, ct.zone.width, ct.zone.height);
      }
    }
    for (const cp of level.checkpoints) {
      const reached = world.activeCheckpoint?.x === cp.respawnX && world.activeCheckpoint?.y === cp.respawnY;
      drawFlag(ctx, cp.zone, reached ? '#4ade80' : CHECKPOINT_IDLE);
      if (this.debug) { ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2; ctx.strokeRect(cp.zone.x, cp.zone.y, cp.zone.width, cp.zone.height); }
    }
    for (const zone of level.fakeCheckpoints) {
      drawFlag(ctx, zone, CHECKPOINT_IDLE);
      if (this.debug) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.strokeRect(zone.x, zone.y, zone.width, zone.height); }
    }
    // #8 도망가는 발판: 현재 위치에 일반 발판처럼 그린다(트리거는 디버그에서만).
    for (const d of world.dodgingPlatforms) {
      const r = dodgingRect(d);
      drawGround(ctx, r, view, { x: r.x - d.config.platform.x, y: r.y - d.config.platform.y }); // 무늬가 발판과 같이 움직인다
      if (this.debug) { const t = d.config.trigger; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.strokeRect(t.x, t.y, t.width, t.height); }
    }
    // #10 솟아오르는 가시: 솟기 전에는 아무것도 없고(바닥과 같음), 솟으면 삼각형 가시를 줄지어 그린다.
    for (const sp of world.popUpSpikes) {
      const r = sp.config.spikes;
      if (sp.raised) drawSpikes(ctx, r);
      if (this.debug) {
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.width, r.height);
        const t = sp.config.trigger; ctx.strokeStyle = '#38bdf8'; ctx.strokeRect(t.x, t.y, t.width, t.height);
      }
    }
    // #25 내려오는 천장: 현재 위치에 평범한 블록으로 그린다(트리거는 디버그에서만).
    for (const c of world.descendingCeilings) {
      const r = descendingRect(c);
      drawBlock(ctx, r, view, 'bottom'); // 아랫면 테두리(내려오는 쪽)
      if (this.debug) { const t = c.config.trigger; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.strokeRect(t.x, t.y, t.width, t.height); }
    }
    // #27 박자 발판: 나타나 있으면 일반 발판, 사라지기 0.3초 전에는 0.1초마다 깜박이고, 사라진 동안은 흐린 자리만 보인다.
    for (const rp of level.rhythmPlatforms) {
      const r = rp.rect;
      if (!inView(r)) continue;
      const { solid, warning } = rhythmPhase(rp, world.lifeTime);
      if (!solid) { ctx.fillStyle = RHYTHM_GHOST; ctx.fillRect(r.x, r.y, r.width, r.height); continue; }
      const flash = warning && Math.floor(world.lifeTime * 10) % 2 === 0;
      if (flash) { ctx.fillStyle = RHYTHM_WARNING_FILL; ctx.fillRect(r.x, r.y, r.width, r.height); }
      else drawGround(ctx, r, view);
    }
    // #28 얼음 바닥: 바닥 윗면을 얼음색으로 덮고 반짝이 줄을 긋는다(보이는 함정).
    for (const t of level.iceFloors) {
      if (!inView(t)) continue;
      ctx.fillStyle = ICE_FILL; ctx.fillRect(t.x, t.y, t.width, Math.min(10, t.height));
      ctx.fillStyle = ICE_SHINE;
      for (let x = t.x + 6; x + 10 <= t.x + t.width; x += 24) ctx.fillRect(x, t.y + 2, 10, 2);
    }
    // #24 무거운 신발 구역은 보이지 않는다(디버그에서만).
    if (this.debug) { ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; for (const h of level.heavyZones) ctx.strokeRect(h.zone.x, h.zone.y, h.zone.width, h.zone.height); }
    // #17 스프링 바닥: 튕기기 전에는 아래 바닥과 똑같아 따로 그리지 않고, 튕긴 뒤에는 그 목숨 동안 눌린 스프링으로 그린다.
    for (const sf of world.springFloors) {
      const t = sf.config.tile;
      if (sf.bounced) {
        ctx.fillStyle = '#101729'; ctx.fillRect(t.x, t.y, t.width, 8);
        ctx.fillStyle = SPRING_FILL; ctx.fillRect(t.x + 2, t.y, t.width - 4, 3);
        ctx.strokeStyle = SPRING_FILL; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(t.x + 4, t.y + 4);
        for (let x = t.x + 4, up = false; x <= t.x + t.width - 4; x += 4, up = !up) ctx.lineTo(x, up ? t.y + 4 : t.y + 7);
        ctx.stroke();
      }
      if (this.debug) { ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.strokeRect(t.x, t.y, t.width, t.height); }
    }
    // #15 날려버리는 점프·#16 좌우 반전 구역은 보이지 않는다(디버그 오버레이에서만 외곽선).
    if (this.debug) {
      ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
      for (const f of level.flingZones) ctx.strokeRect(f.zone.x, f.zone.y, f.zone.width, f.zone.height);
      for (const z of level.reverseZones) ctx.strokeRect(z.x, z.y, z.width, z.height);
    }
    // #20 가짜 벽: 공중 블록과 똑같이 그리다가, 한 번 겹치면 그 목숨 동안 반투명하게.
    for (const w of world.fakeWalls) {
      if (!inView(w.rect)) continue;
      const r = w.rect;
      if (w.revealed) { ctx.fillStyle = FAKE_WALL_REVEALED; ctx.fillRect(r.x, r.y, r.width, r.height); }
      else {
        drawBlock(ctx, r, view);
      }
      if (this.debug) { ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.width, r.height); }
    }
    // #21 미끼 보물: 마름모 보석에 반짝임. 먹으면 그리지 않는다.
    for (const g of world.baitGems) {
      if (g.taken) continue;
      const r = gemRect(g.config);
      ctx.fillStyle = GEM_FILL;
      ctx.beginPath();
      ctx.moveTo(r.x + r.width / 2, r.y); ctx.lineTo(r.x + r.width, r.y + r.height / 2);
      ctx.lineTo(r.x + r.width / 2, r.y + r.height); ctx.lineTo(r.x, r.y + r.height / 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = GEM_SHINE; ctx.fillRect(r.x + r.width / 2 - 2, r.y + 5, 4, 4);
    }
    // #14 가짜 클리어: 바닥은 일반 바닥처럼(꺼지면 그리지 않음), 깃발은 진짜 목표와 똑같이 그린다.
    for (const fg of world.fakeGoals) {
      if (!fg.collapsed) {
        for (const f of fg.config.floor) {
          drawGround(ctx, f, view);
          if (this.debug) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.strokeRect(f.x, f.y, f.width, f.height); }
        }
      }
      const flag = fg.config.flag;
      drawGoal(ctx, flag, wave); // 진짜 목표와 같은 그림·같은 물결 프레임
    }
    // #18 가짜 안내 표지판: 기둥과 판자에 문구. 동작은 없다(짝이 되는 근처 함정이 동작한다).
    ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
    for (const sign of level.signs) {
      drawSign(ctx, sign.x, sign.y);
      ctx.fillStyle = '#3b2f22'; ctx.fillText(sign.text, sign.x, sign.y - 67);
    }
    ctx.textAlign = 'left';
    // #23 착지 예측 가시: 솟은 가시는 10번과 같은 모양. 구역은 보이지 않는다(디버그에서만).
    for (const ls of world.landingSpikes) {
      if (ls.spikes) drawSpikes(ctx, ls.spikes);
      if (this.debug) { ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; ctx.strokeRect(ls.zone.x, ls.zone.y, ls.zone.width, ls.zone.height); }
    }
    const goal = world.goal.rect; // #12 도망가는 목표: 현재(이동 중이면 이동 중인) 위치
    drawGoal(ctx, goal, wave);
    // #30 세 번째 착지에 무너지는 발판: 일반 발판에 착지 횟수만큼 금(세로 줄)을 긋는다. 무너지면 그리지 않는다.
    for (const c of world.countingPlatforms) {
      if (!c.solid || !inView(c.config.rect)) continue;
      const r = c.config.rect;
      drawGround(ctx, r, view);
      ctx.fillStyle = CRACK_FILL;
      for (let i = 0; i < c.count; i++) ctx.fillRect(r.x + ((i + 1) * r.width) / (c.config.landings + 1) - 1, r.y, 2, r.height);
    }
    // #29 따라 뛰는 적: 일반 왕복 적과 똑같이 그린다(처음엔 구분되지 않아야 한다).
    for (const m of world.mirrorEnemies) {
      drawEnemy(ctx, m.enemy);
      if (this.debug) { ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2; ctx.strokeRect(m.enemy.x, m.enemy.y, m.enemy.width, m.enemy.height); }
    }
    for (const e of world.enemies) {
      drawEnemy(ctx, e);
      if (this.debug) { ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2; ctx.strokeRect(e.x, e.y, e.width, e.height); }
    }
    for (const amb of world.ambushes) {
      if (amb.enemy) {
        const e = amb.enemy;
        drawEnemy(ctx, e);
        if (this.debug) { ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2; ctx.strokeRect(e.x, e.y, e.width, e.height); }
      } else if (amb.warningTimer !== null && Math.floor(amb.warningTimer * 10) % 2 === 0) {
        const { minX, y } = amb.config;
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3;
        ctx.strokeRect(minX, y, ENEMY_WIDTH, ENEMY_HEIGHT);
      }
      if (this.debug) { ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.strokeRect(amb.config.trigger.x, amb.config.trigger.y, amb.config.trigger.width, amb.config.trigger.height); }
    }
    // 사망 원인 표시: 가짜 안전지대는 위에서 타일 자체를 경고색으로 칠하고, 그 밖의 함정·적 구간은 영역 위에
    // 반투명 경고색과 테두리를 겹친다(docs/traps-spec.md "공통 규칙").
    const cause = world.deathCause?.rect;
    if (cause && !level.hazards.includes(cause)) {
      ctx.fillStyle = DEATH_CAUSE_OVERLAY; ctx.fillRect(cause.x, cause.y, cause.width, cause.height);
      ctx.strokeStyle = HAZARD_REVEAL_TOP; ctx.lineWidth = 3; ctx.strokeRect(cause.x, cause.y, cause.width, cause.height);
    }
    // #13 하늘에서 쏟아지는 적: 경고 중에는 떨어질 x 위치의 화면 맨 위에 점멸 표시, 떨어지는 중·착지 후에는 적을 그린다.
    for (const g of world.skyDrops) {
      for (const se of g.enemies) {
        if (se.phase === 'warning' && g.elapsed !== null && Math.floor((g.elapsed - se.drop.delay) * 10) % 2 === 0) {
          ctx.fillStyle = SKY_WARNING_FILL;
          ctx.beginPath(); ctx.moveTo(se.drop.x, 0); ctx.lineTo(se.drop.x + ENEMY_WIDTH, 0); ctx.lineTo(se.drop.x + ENEMY_WIDTH / 2, 14); ctx.closePath(); ctx.fill();
          ctx.fillRect(se.drop.x, 0, ENEMY_WIDTH, 4);
        }
        if (se.enemy) {
          drawEnemy(ctx, se.enemy);
          if (this.debug) { ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2; ctx.strokeRect(se.enemy.x, se.enemy.y, se.enemy.width, se.enemy.height); }
        }
      }
      if (this.debug) { const t = g.config.trigger; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.strokeRect(t.x, t.y, t.width, t.height); }
    }
    // #19 따라오는 돌덩이: 굴러가는 동안만 모서리를 깎은 돌로 그린다(트리거는 디버그에서만). 굴러가는 느낌을 위해
    // 이동 거리에 따라 무늬 줄이 돌아간다.
    for (const b of world.boulders) {
      if (b.phase === 'rolling') {
        const r = boulderRect(b);
        ctx.fillStyle = BOULDER_FILL;
        ctx.fillRect(r.x + 12, r.y, r.width - 24, r.height);
        ctx.fillRect(r.x, r.y + 12, r.width, r.height - 24);
        ctx.fillRect(r.x + 5, r.y + 5, r.width - 10, r.height - 10);
        const k = ((b.x - b.config.startX) / 16) % 4;
        ctx.fillStyle = BOULDER_SHADE;
        ctx.fillRect(r.x + 10 + k * 10, r.y + 14, 6, r.height - 28);
      }
      if (this.debug) { const t = b.config.trigger; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.strokeRect(t.x, t.y, t.width, t.height); }
    }
    // #22 따라 하는 그림자: 120번째 스텝 전에는 트리거한 자리에 충돌 없는 윤곽이 점점 진해지고, 그 뒤에는 반투명한 그림자.
    for (const sh of world.shadows) {
      if (sh.body) {
        const r = shadowRect(sh.body);
        ctx.fillStyle = SHADOW_FILL; ctx.fillRect(r.x, r.y, r.width, r.height);
      } else if (sh.phase === 'active' && sh.origin) {
        const r = shadowRect(sh.origin);
        ctx.fillStyle = `rgba(${SHADOW_OUTLINE_RGB},${(0.5 * Math.min(1, sh.steps / SHADOW_DELAY_STEPS)).toFixed(3)})`;
        ctx.fillRect(r.x, r.y, r.width, r.height);
      }
      if (this.debug) { const t = sh.config.trigger; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.strokeRect(t.x, t.y, t.width, t.height); }
    }
    // #26 화살 발사대: 경고 중에는 화살이 들어올 쪽 화면 가장자리, 화살 높이에 0.1초 간격으로 깜박이는 표시를 띄우고,
    // 날아가는 동안은 화살대와 촉을 그린다(트리거는 디버그에서만).
    for (const t of world.arrowTraps) {
      for (const a of t.arrows) {
        const dir = a.arrow.toX >= a.arrow.fromX ? 1 : -1;
        if (a.phase === 'warning' && t.elapsed !== null && Math.floor((t.elapsed - a.arrow.delay) * 10) % 2 === 0) {
          ctx.fillStyle = ARROW_WARNING_FILL;
          ctx.fillRect(dir > 0 ? cam : cam + VIEW_WIDTH - 12, a.arrow.y - 3, 12, 12);
        }
        if (a.phase === 'flying') {
          const r = arrowRect(a);
          ctx.fillStyle = ARROW_FILL; ctx.fillRect(r.x, r.y + 2, r.width, 2);
          const tip = dir > 0 ? r.x + r.width : r.x;
          ctx.beginPath(); ctx.moveTo(tip, r.y + 3); ctx.lineTo(tip - dir * 8, r.y); ctx.lineTo(tip - dir * 8, r.y + r.height); ctx.closePath(); ctx.fill();
        }
      }
      if (this.debug) { const tr = t.config.trigger; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.strokeRect(tr.x, tr.y, tr.width, tr.height); }
    }
    ctx.fillStyle = DEBRIS_FILL;
    for (const d of this.debris) ctx.fillRect(d.x - DEBRIS_SIZE / 2, d.y, DEBRIS_SIZE, DEBRIS_SIZE);
    const p = world.player;
    drawPixelSprite(ctx, playerFrame(p), p.x, p.y, p.width, p.height, p.facing < 0);
    if (this.debug) { ctx.strokeStyle = '#ff3b87'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.width, p.height); }
    // 플레이어를 바꾸는 구역 표시: 좌우 반전(#16) "⇄", 무거운 신발(#24) "⤓". 명세상 두 구역은 겹치지 않지만 겹쳐도 함께 보인다.
    const marks = [world.reverse ? REVERSE_MARK : '', world.heavyShoes ? HEAVY_MARK : ''].filter(Boolean).join(' ');
    if (marks) {
      ctx.fillStyle = TAUNT_COLOR; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(marks, p.x + p.width / 2, p.y - 8);
      ctx.textAlign = 'left';
    }
    ctx.restore();
    ctx.fillStyle = '#d5dee7'; ctx.font = '14px system-ui';
    ctx.fillText(`WORLD HEIGHT ${level.height}   |   ${this.debug ? 'COLLIDERS ON' : 'PRESS B FOR COLLIDERS'}`, 20, 28);
    if (this.debug) {
      const vx = p.vx.toFixed(0), vy = p.vy.toFixed(0);
      ctx.fillText(`FPS ${metrics.fps.toFixed(0)}   |   STEPS/FRAME ${metrics.steps}   |   VX ${vx}   |   VY ${vy}`, 20, 48);
    }
    // 놀리는 사망 메시지: 함정에 당한 직후 2초 동안 캔버스 위쪽 가운데에 띄운다.
    if (world.taunt) {
      ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(16,23,41,0.75)'; ctx.fillRect(VIEW_WIDTH / 2 - 200, 96, 400, 40);
      ctx.fillStyle = TAUNT_COLOR; ctx.fillText(TAUNTS[world.taunt.kind], VIEW_WIDTH / 2, 124);
      ctx.textAlign = 'left';
    }
    if (world.cleared || world.fakeClear) { // 가짜 클리어(#14)도 똑같이 띄운다
      ctx.fillStyle = GOAL_FILL; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('LEVEL CLEAR', VIEW_WIDTH / 2, 80);
      ctx.textAlign = 'left';
    }
    if (paused) {
      ctx.fillStyle = 'rgba(16,23,41,0.7)'; ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.fillStyle = '#d5dee7'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('PAUSED', VIEW_WIDTH / 2, VIEW_HEIGHT / 2);
      ctx.font = '14px system-ui';
      ctx.fillText('P 또는 일시정지/재개 버튼으로 재개', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 28); // 터치 기기엔 P 키가 없다
      ctx.textAlign = 'left';
    }
  }
}
