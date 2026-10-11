import { overlaps, type Rect } from './AABB';
import type { Player } from '../entities/Player';

const MAX_SUBSTEP = 6;

/** Axis separated collision resolution, with bounded movement substeps. */
export function moveWithCollisions(player: Player, solids: readonly Rect[], dx: number, dy: number): void {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_SUBSTEP));
  const stepX = dx / steps;
  const stepY = dy / steps;
  player.grounded = false;

  for (let i = 0; i < steps; i++) {
    if (stepX !== 0) {
      player.x += stepX;
      for (const solid of solids) {
        if (!overlaps(player, solid)) continue;
        if (stepX > 0) player.x = solid.x - player.width;
        else player.x = solid.x + solid.width;
        player.vx = 0;
      }
    }
    if (stepY !== 0) {
      player.y += stepY;
      let landed = false;
      for (const solid of solids) {
        if (!overlaps(player, solid)) continue;
        if (stepY > 0) { player.y = solid.y - player.height; landed = true; }
        else player.y = solid.y + solid.height;
        player.vy = 0;
      }
      player.grounded = landed;
    }
  }
}
