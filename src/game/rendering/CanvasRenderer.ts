import { SOLIDS, WORLD_HEIGHT } from '../world/level';
import { cameraX } from './Camera';
import type { World } from '../world/World';

export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;
export class CanvasRenderer {
  debug = false;
  constructor(private readonly canvas: HTMLCanvasElement) {}
  render(world: World): void {
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
    const p = world.player;
    ctx.fillStyle = '#fa8966'; ctx.fillRect(p.x, p.y, p.width, p.height);
    ctx.fillStyle = '#16151c'; ctx.fillRect(p.x + 17, p.y + 8, 4, 4);
    if (this.debug) { ctx.strokeStyle = '#ff3b87'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.width, p.height); }
    ctx.restore();
    ctx.fillStyle = '#d5dee7'; ctx.font = '14px system-ui';
    ctx.fillText(`WORLD HEIGHT ${WORLD_HEIGHT}   |   ${this.debug ? 'COLLIDERS ON' : 'PRESS B FOR COLLIDERS'}`, 20, 28);
  }
}
