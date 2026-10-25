import { ENEMY_HEIGHT, ENEMY_WIDTH, type Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { cameraX, VIEW_WIDTH } from '../world/viewport';
import {
  drawPixelSprite, ENEMY_WALK_1, ENEMY_WALK_2, PLAYER_IDLE, PLAYER_JUMP, PLAYER_WALK_1, PLAYER_WALK_2,
} from './Sprites';
import type { World } from '../world/World';

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
    ctx.fillStyle = '#293b4d';
    for (let i = 0; i < 18; i++) { ctx.fillRect(i * 130, 390 - (i % 4) * 35, 90, 200); }
    for (const p of level.solids) {
      ctx.fillStyle = '#627e55'; ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.fillStyle = '#99c577'; ctx.fillRect(p.x, p.y, p.width, Math.min(8, p.height));
      if (this.debug) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.width, p.height); }
    }
    for (const h of level.hazards) {
      // 평소엔 일반 바닥과 똑같이 그리고, 이 타일로 사망한 직후에만 경고색으로 원인을 드러낸다(traps-spec #4).
      const revealed = world.hazardReveal?.rect === h;
      ctx.fillStyle = revealed ? HAZARD_REVEAL_FILL : '#627e55'; ctx.fillRect(h.x, h.y, h.width, h.height);
      ctx.fillStyle = revealed ? HAZARD_REVEAL_TOP : '#99c577'; ctx.fillRect(h.x, h.y, h.width, Math.min(8, h.height));
      if (revealed) { ctx.strokeStyle = HAZARD_REVEAL_TOP; ctx.lineWidth = 3; ctx.strokeRect(h.x, h.y, h.width, h.height); }
      if (this.debug) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.strokeRect(h.x, h.y, h.width, h.height); }
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
      ctx.fillStyle = reached ? '#4ade80' : '#64748b';
      ctx.fillRect(cp.zone.x + cp.zone.width / 2 - 2, cp.zone.y, 4, cp.zone.height);
      ctx.beginPath();
      ctx.moveTo(cp.zone.x + cp.zone.width / 2 + 2, cp.zone.y);
      ctx.lineTo(cp.zone.x + cp.zone.width / 2 + 22, cp.zone.y + 10);
      ctx.lineTo(cp.zone.x + cp.zone.width / 2 + 2, cp.zone.y + 20);
      ctx.closePath();
      ctx.fill();
      if (this.debug) { ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2; ctx.strokeRect(cp.zone.x, cp.zone.y, cp.zone.width, cp.zone.height); }
    }
    ctx.fillStyle = '#eab308'; ctx.fillRect(level.goal.x, level.goal.y, level.goal.width, level.goal.height);
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
