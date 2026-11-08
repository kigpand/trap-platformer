import type { Level } from '../../../src/game/world/level';
import { defineLevel } from '../../../src/game/world/levelData';
import type { World } from '../../../src/game/world/World';

// 함정 하나씩만 둔 작은 시험용 레벨. 지정하지 않은 배치는 비어 있다.
export function testLevel(parts: Partial<Level>): Level {
  return defineLevel({ width: 2000, height: 620, spawn: { x: 65, y: 350 }, solids: [], goal: { x: 1990, y: 0, width: 10, height: 10 }, checkpoints: [], ...parts });
}

export function standAt(world: World, x: number, groundY = 500): void {
  world.player.x = x; world.player.y = groundY - world.player.height; world.player.vy = 0; world.player.grounded = true;
}
