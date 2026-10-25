import { ENEMY_HEIGHT, ENEMY_WIDTH, type Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { cameraX, VIEW_WIDTH } from '../world/viewport';
import {
  drawPixelSprite, ENEMY_WALK_1, ENEMY_WALK_2, PLAYER_IDLE, PLAYER_JUMP, PLAYER_WALK_1, PLAYER_WALK_2,
} from './Sprites';
import { ceilingRect, dodgingRect, vanishingTile, vanishingTileCount, type World } from '../world/World';
import type { Rect } from '../physics/AABB';

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
const BLOCK_FILL = '#8a6d4b'; // 공중 블록(투명 블록이 나타난 뒤·떨어지는 천장)
const BLOCK_TOP = '#b08a5e';
export const SPIKE_FILL = '#e2e8f0';
const CHECKPOINT_IDLE = '#64748b';

// 체크포인트 깃발. 가짜 체크포인트(#11)도 일부러 같은 모양으로 그린다(처음엔 구분되지 않아야 한다).
// 깃대는 판정 영역 높이와 상관없이 영역 바닥에서 FLAG_HEIGHT만큼 그린다 — 진짜는 건너뛸 수 없게 영역이 높고
// 가짜는 넘을 수 있게 낮아서, 영역 높이로 그리면 한눈에 구분됐다(Codex 리뷰).
const FLAG_HEIGHT = 80;
function drawFlag(ctx: CanvasRenderingContext2D, zone: Rect, color: string): void {
  const top = zone.y + zone.height - FLAG_HEIGHT;
  ctx.fillStyle = color;
  ctx.fillRect(zone.x + zone.width / 2 - 2, top, 4, FLAG_HEIGHT);
  ctx.beginPath();
  ctx.moveTo(zone.x + zone.width / 2 + 2, top);
  ctx.lineTo(zone.x + zone.width / 2 + 22, top + 10);
  ctx.lineTo(zone.x + zone.width / 2 + 2, top + 20);
  ctx.closePath();
  ctx.fill();
}
export class CanvasRenderer {
  debug = false;
  constructor(private readonly canvas: HTMLCanvasElement) {}
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
    ctx.save(); ctx.translate(-cam, 0);
    // 배경 건물: 130px 간격으로 반복하되 카메라에 보이는 것만 그린다 — 레벨이 길어져도 끝까지 이어지고 그리기 양은 같다.
    ctx.fillStyle = '#293b4d';
    const firstBuilding = Math.max(0, Math.floor(cam / BUILDING_SPACING) - 1);
    const lastBuilding = Math.ceil((cam + VIEW_WIDTH) / BUILDING_SPACING);
    for (let i = firstBuilding; i <= lastBuilding; i++) ctx.fillRect(i * BUILDING_SPACING, 390 - (i % 4) * 35, 90, 200);
    for (const p of level.solids) {
      ctx.fillStyle = '#627e55'; ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.fillStyle = '#99c577'; ctx.fillRect(p.x, p.y, p.width, Math.min(8, p.height));
      if (this.debug) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.width, p.height); }
    }
    for (const h of level.hazards) {
      // 평소엔 일반 바닥과 똑같이 그리고, 이 타일로 사망한 직후에만 경고색으로 원인을 드러낸다(traps-spec #4).
      const revealed = world.deathCause?.rect === h;
      ctx.fillStyle = revealed ? HAZARD_REVEAL_FILL : '#627e55'; ctx.fillRect(h.x, h.y, h.width, h.height);
      ctx.fillStyle = revealed ? HAZARD_REVEAL_TOP : '#99c577'; ctx.fillRect(h.x, h.y, h.width, Math.min(8, h.height));
      if (revealed) { ctx.strokeStyle = HAZARD_REVEAL_TOP; ctx.lineWidth = 3; ctx.strokeRect(h.x, h.y, h.width, h.height); }
      if (this.debug) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.strokeRect(h.x, h.y, h.width, h.height); }
    }
    // #6 사라지는 땅: 남은 칸은 일반 바닥처럼, 붕괴가 시작되면 다음에 사라질 칸만 경고색으로.
    for (const vg of world.vanishingGrounds) {
      for (let i = vg.tilesGone; i < vanishingTileCount(vg.rect); i++) {
        const t = vanishingTile(vg.rect, i);
        const warning = vg.elapsed !== null && i === vg.tilesGone;
        ctx.fillStyle = warning ? VANISH_WARNING_FILL : '#627e55'; ctx.fillRect(t.x, t.y, t.width, t.height);
        ctx.fillStyle = warning ? VANISH_WARNING_FILL : '#99c577'; ctx.fillRect(t.x, t.y, t.width, Math.min(8, t.height));
      }
      if (this.debug) { ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 2; ctx.strokeRect(vg.rect.x, vg.rect.y, vg.rect.width, vg.rect.height); }
    }
    // #7 투명 블록: 나타나기 전에는 그리지 않는다(디버그 오버레이에서만 외곽선).
    for (const ib of world.invisibleBlocks) {
      if (ib.visible) {
        ctx.fillStyle = BLOCK_FILL; ctx.fillRect(ib.rect.x, ib.rect.y, ib.rect.width, ib.rect.height);
        ctx.fillStyle = BLOCK_TOP; ctx.fillRect(ib.rect.x, ib.rect.y, ib.rect.width, Math.min(4, ib.rect.height));
      } else if (this.debug) { ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2; ctx.strokeRect(ib.rect.x, ib.rect.y, ib.rect.width, ib.rect.height); }
    }
    // #9 떨어지는 천장: 현재 위치에 평범한 블록으로 그린다(트리거 영역은 디버그에서만).
    for (const c of world.fallingCeilings) {
      if (c.phase !== 'gone') {
        const r = ceilingRect(c);
        ctx.fillStyle = BLOCK_FILL; ctx.fillRect(r.x, r.y, r.width, r.height);
        ctx.fillStyle = BLOCK_TOP; ctx.fillRect(r.x, r.y, r.width, Math.min(4, r.height));
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
      ctx.fillStyle = '#627e55'; ctx.fillRect(hb.rect.x, hb.rect.y, hb.rect.width, hb.rect.height);
      ctx.fillStyle = '#99c577'; ctx.fillRect(hb.rect.x, hb.rect.y, hb.rect.width, Math.min(8, hb.rect.height));
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
      ctx.fillStyle = '#627e55'; ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.fillStyle = '#99c577'; ctx.fillRect(r.x, r.y, r.width, Math.min(8, r.height));
      if (this.debug) { const t = d.config.trigger; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.strokeRect(t.x, t.y, t.width, t.height); }
    }
    // #10 솟아오르는 가시: 솟기 전에는 아무것도 없고(바닥과 같음), 솟으면 삼각형 가시를 줄지어 그린다.
    for (const sp of world.popUpSpikes) {
      const r = sp.config.spikes;
      if (sp.raised) {
        ctx.fillStyle = SPIKE_FILL;
        ctx.fillRect(r.x, r.y + r.height - 4, r.width, 4); // 받침
        for (let x = r.x; x + 8 <= r.x + r.width + 0.5; x += 8) {
          ctx.beginPath(); ctx.moveTo(x, r.y + r.height); ctx.lineTo(x + 4, r.y); ctx.lineTo(x + 8, r.y + r.height); ctx.closePath(); ctx.fill();
        }
      }
      if (this.debug) {
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.width, r.height);
        const t = sp.config.trigger; ctx.strokeStyle = '#38bdf8'; ctx.strokeRect(t.x, t.y, t.width, t.height);
      }
    }
    const goal = world.goal.rect; // #12 도망가는 목표: 현재(이동 중이면 이동 중인) 위치
    ctx.fillStyle = '#eab308'; ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
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
    const p = world.player;
    drawPixelSprite(ctx, playerFrame(p), p.x, p.y, p.width, p.height, p.facing < 0);
    if (this.debug) { ctx.strokeStyle = '#ff3b87'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.width, p.height); }
    ctx.restore();
    ctx.fillStyle = '#d5dee7'; ctx.font = '14px system-ui';
    ctx.fillText(`WORLD HEIGHT ${level.height}   |   ${this.debug ? 'COLLIDERS ON' : 'PRESS B FOR COLLIDERS'}`, 20, 28);
    if (this.debug) {
      const vx = p.vx.toFixed(0), vy = p.vy.toFixed(0);
      ctx.fillText(`FPS ${metrics.fps.toFixed(0)}   |   STEPS/FRAME ${metrics.steps}   |   VX ${vx}   |   VY ${vy}`, 20, 48);
    }
    if (world.cleared) {
      ctx.fillStyle = '#eab308'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center';
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
