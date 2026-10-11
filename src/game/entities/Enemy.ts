import type { Rect } from '../physics/AABB';

export interface Enemy extends Rect { vx: number; minX: number; maxX: number }
export const ENEMY_WIDTH = 28;
export const ENEMY_HEIGHT = 28;
export const ENEMY_SPEED = 120; // 플레이어(210px/s)보다 느림 — 패턴 관찰·회피 시간 보장 (docs/traps-spec.md 적 충돌 규칙)

export function createEnemy(minX: number, maxX: number, y: number): Enemy {
  return { x: minX, y, width: ENEMY_WIDTH, height: ENEMY_HEIGHT, vx: ENEMY_SPEED, minX, maxX };
}

// 고정 구간을 왕복하는 단순 이동만 지원한다. 추적 AI·가속·발사체는 범위 밖 (docs/traps-spec.md).
export function updateEnemy(enemy: Enemy, dt: number): void {
  enemy.x += enemy.vx * dt;
  if (enemy.x <= enemy.minX) { enemy.x = enemy.minX; enemy.vx = Math.abs(enemy.vx); }
  else if (enemy.x + enemy.width >= enemy.maxX) { enemy.x = enemy.maxX - enemy.width; enemy.vx = -Math.abs(enemy.vx); }
}
