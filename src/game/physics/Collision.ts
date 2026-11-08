import { overlaps, type Rect } from './AABB';
import type { Player } from '../entities/Player';

export const MAX_SUBSTEP = 6;

/**
 * Axis separated collision resolution, with bounded movement substeps.
 * platforms는 한쪽 통과 발판이다: 아래로 움직이는 하위 단계에서 발이 윗면 위(같은 높이 포함)에서 윗면 아래로 지나갈 때만
 * 윗면에 세운다. 위로·옆으로는 막지 않는다(docs/physics-spec.md "한쪽 통과 발판").
 */
export function moveWithCollisions(player: Player, solids: readonly Rect[], dx: number, dy: number, platforms: readonly Rect[] = []): void {
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
      const feetBefore = player.y + player.height;
      player.y += stepY;
      let landed = false;
      if (stepY > 0) {
        for (const p of platforms) {
          const feet = player.y + player.height;
          if (feetBefore <= p.y + 1e-6 && feet > p.y && player.x < p.x + p.width && player.x + player.width > p.x) {
            player.y = p.y - player.height; player.vy = 0; landed = true;
          }
        }
      }
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
