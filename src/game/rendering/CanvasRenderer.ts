import { ENEMY_HEIGHT, ENEMY_WIDTH } from '../entities/Enemy';
import { CHECKPOINTS, GOAL, HAZARDS, SOLIDS, WORLD_HEIGHT } from '../world/level';
import { cameraX } from './Camera';
import type { World } from '../world/World';

export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;
// game/core가 이 모양으로 넘겨준다(FrameMetrics) — 타입만 필요하므로 core -> rendering
// 의존 방향을 만들지 않게 구조적으로만 맞춘다.
export interface RenderMetrics { fps: number; steps: number }
export class CanvasRenderer {
  debug = false;
  constructor(private readonly canvas: HTMLCanvasElement) {}
  render(world: World, metrics: RenderMetrics): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(VIEW_WIDTH * scale), height = Math.round(VIEW_HEIGHT * scale);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = '#101729'; ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    const cam = cameraX(world.player.x, VIEW_WIDTH);
    ctx.save(); ctx.translate(-cam, 0);
    ctx.fillStyle = '#293b4d';
    for (let i = 0; i < 18; i++) { ctx.fillRect(i * 130, 390 - (i % 4) * 35, 90, 200); }
    for (const p of SOLIDS) {
      ctx.fillStyle = '#627e55'; ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.fillStyle = '#99c577'; ctx.fillRect(p.x, p.y, p.width, Math.min(8, p.height));
      if (this.debug) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.width, p.height); }
    }
    for (const h of HAZARDS) {
      ctx.fillStyle = '#627e55'; ctx.fillRect(h.x, h.y, h.width, h.height);
      ctx.fillStyle = '#99c577'; ctx.fillRect(h.x, h.y, h.width, Math.min(8, h.height));
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
    for (const cp of CHECKPOINTS) {
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
    ctx.fillStyle = '#eab308'; ctx.fillRect(GOAL.x, GOAL.y, GOAL.width, GOAL.height);
    for (const e of world.enemies) {
      ctx.fillStyle = '#dc2626'; ctx.fillRect(e.x, e.y, e.width, e.height);
      ctx.fillStyle = '#16151c'; ctx.fillRect(e.x + 8, e.y + 8, 4, 4); ctx.fillRect(e.x + 16, e.y + 8, 4, 4);
      if (this.debug) { ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2; ctx.strokeRect(e.x, e.y, e.width, e.height); }
    }
    for (const amb of world.ambushes) {
      if (amb.enemy) {
        const e = amb.enemy;
        ctx.fillStyle = '#dc2626'; ctx.fillRect(e.x, e.y, e.width, e.height);
        ctx.fillStyle = '#16151c'; ctx.fillRect(e.x + 8, e.y + 8, 4, 4); ctx.fillRect(e.x + 16, e.y + 8, 4, 4);
        if (this.debug) { ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2; ctx.strokeRect(e.x, e.y, e.width, e.height); }
      } else if (amb.warningTimer !== null && Math.floor(amb.warningTimer * 10) % 2 === 0) {
        const { minX, y } = amb.config;
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3;
        ctx.strokeRect(minX, y, ENEMY_WIDTH, ENEMY_HEIGHT);
      }
      if (this.debug) { ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.strokeRect(amb.config.trigger.x, amb.config.trigger.y, amb.config.trigger.width, amb.config.trigger.height); }
    }
    const p = world.player;
    ctx.fillStyle = '#fa8966'; ctx.fillRect(p.x, p.y, p.width, p.height);
    ctx.fillStyle = '#16151c'; ctx.fillRect(p.x + 17, p.y + 8, 4, 4);
    if (this.debug) { ctx.strokeStyle = '#ff3b87'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.width, p.height); }
    ctx.restore();
    ctx.fillStyle = '#d5dee7'; ctx.font = '14px system-ui';
    ctx.fillText(`WORLD HEIGHT ${WORLD_HEIGHT}   |   ${this.debug ? 'COLLIDERS ON' : 'PRESS B FOR COLLIDERS'}`, 20, 28);
    if (this.debug) {
      const vx = p.vx.toFixed(0), vy = p.vy.toFixed(0);
      ctx.fillText(`FPS ${metrics.fps.toFixed(0)}   |   STEPS/FRAME ${metrics.steps}   |   VX ${vx}   |   VY ${vy}`, 20, 48);
    }
    if (world.cleared) {
      ctx.fillStyle = '#eab308'; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('LEVEL CLEAR', VIEW_WIDTH / 2, 80);
      ctx.textAlign = 'left';
    }
  }
}
