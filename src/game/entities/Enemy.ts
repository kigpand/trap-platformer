import type { Rect } from '../physics/AABB';

export interface Enemy extends Rect { vx: number; minX: number; maxX: number }
export const ENEMY_WIDTH = 28;
export const ENEMY_HEIGHT = 28;
export const ENEMY_SPEED = 120; // 플레이어(210px/s)보다 느림 — 패턴 관찰·회피 시간 보장 (docs/traps-spec.md 적 충돌 규칙)

export function createEnemy(minX: number, maxX: number, y: number): Enemy {
  return { x: minX, y, width: ENEMY_WIDTH, height: ENEMY_HEIGHT, vx: ENEMY_SPEED, minX, maxX };
}

// 고정 구간을 왕복하는 단순 이동만 지원한다. 추적 AI·가속·발사체는 범위 밖 (docs/traps-spec.md).
// 구간 안에서 끝을 넘어설 때만 끝에 맞추고 돌아선다. 구간 밖에서 출발한 적(하늘에서 떨어진 적이 구간 밖에 착지한 경우)은
// 위치를 옮기지 않고 구간 쪽으로 걸어 들어온다 — 끝에 맞추면 한 스텝에 순간이동한다(Codex 리뷰).
export function updateEnemy(enemy: Enemy, dt: number): void {
  const prevX = enemy.x;
  enemy.x += enemy.vx * dt;
  if (enemy.vx < 0 && enemy.x <= enemy.minX) {
    if (prevX >= enemy.minX) enemy.x = enemy.minX;
    enemy.vx = Math.abs(enemy.vx);
  } else if (enemy.vx > 0 && enemy.x + enemy.width >= enemy.maxX) {
    if (prevX + enemy.width <= enemy.maxX) enemy.x = enemy.maxX - enemy.width;
    enemy.vx = -Math.abs(enemy.vx);
  }
}
