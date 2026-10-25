import type { Rect } from '../../../src/game/physics/AABB';
import type { Player } from '../../../src/game/entities/Player';
import type { World } from '../../../src/game/world/World';

// 텔레포트 없이 실제 입력만으로 레벨을 통과시키는 보수적인 자동 플레이어.
// 서 있는 발판의 가장자리(간격 포함)나 전방의 위험 요소(위험지대·적 등 solids에 넣지 않은
// 것)가 가까워지면 점프한다 — 숙련된 플레이어의 "엣지 점프"와 달리 약간 더 일찍 뛰어 중간
// 발판에도 착지한다. obstacles는 매 프레임 다시 계산해서 넘기면 움직이는 적에도 반응한다.
export function shouldJump(player: Player, solids: readonly Rect[], obstacles: readonly Rect[]): boolean {
  if (!player.grounded) return false;
  const standingOn = solids.find(
    (s) => player.x < s.x + s.width && player.x + player.width > s.x && Math.abs(player.y + player.height - s.y) < 1,
  );
  const edgeDistance = standingOn ? standingOn.x + standingOn.width - (player.x + player.width) : -1;
  const upcomingObstacle = obstacles.some((h) => h.x >= player.x + player.width && h.x - (player.x + player.width) < 20);
  return standingOn === undefined || edgeDistance < 20 || upcomingObstacle;
}

// 오른쪽으로 달리며 shouldJump로 점프만 결정하는 자동 플레이를, 클리어하거나 maxSteps에 닿을 때까지 돌린다.
export function runToGoal(world: World, maxSteps = 1800): void {
  const input = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
  for (let i = 0; i < maxSteps && !world.cleared; i++) {
    const solids = [...world.level.solids, ...world.dynamicSolids()];
    const spawnedAmbushes = world.ambushes.flatMap((a) => (a.enemy ? [a.enemy] : []));
    const obstacles = [...world.level.hazards, ...world.enemies, ...spawnedAmbushes];
    input.jumpPressed = shouldJump(world.player, solids, obstacles);
    world.update(1 / 60, input);
  }
}
