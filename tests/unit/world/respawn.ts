import { World } from '../../../src/game/world/World';
import type { Checkpoint, Level } from '../../../src/game/world/level';

// fixtures.ts와 따로 둔다: fixtures.ts는 level 모듈을 통째로 mock하는 테스트(FakeClearController.test.ts)가 mock을 만드는 도중에
// 불러오므로, 거기서 World(→ level 모듈)를 런타임에 불러오면 만들어지는 중인 mock을 기다리며 멈춘다.
// 체크포인트에 닿은 뒤 죽은 것처럼, 게임의 사망 재시작 경로로 그 체크포인트에서 시작한 World(사망 1회).
export function respawnFrom(level: Level, cp: Checkpoint): World {
  const world = new World(level);
  world.activeCheckpoint = { x: cp.respawnX, y: cp.respawnY };
  world.reset(true);
  return world;
}
