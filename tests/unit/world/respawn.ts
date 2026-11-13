import { World } from '../../../src/game/world/World';
import type { Checkpoint, Level } from '../../../src/game/world/level';

// 체크포인트에 닿은 뒤 죽은 것처럼, 게임의 사망 재시작 경로로 그 체크포인트에서 시작한 World(사망 1회).
export function respawnFrom(level: Level, cp: Checkpoint): World {
  const world = new World(level);
  world.activeCheckpoint = { x: cp.respawnX, y: cp.respawnY };
  world.reset(true);
  return world;
}
