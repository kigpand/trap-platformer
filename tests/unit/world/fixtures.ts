import type { Level } from '../../../src/game/world/level';
import { defineLevel } from '../../../src/game/world/levelData';
import type { InputState, World } from '../../../src/game/world/World';

// 함정 하나씩만 둔 작은 시험용 레벨. 지정하지 않은 배치는 비어 있다.
export function testLevel(parts: Partial<Level>): Level {
  return defineLevel({ width: 2000, height: 620, spawn: { x: 65, y: 350 }, solids: [], goal: { x: 1990, y: 0, width: 10, height: 10 }, checkpoints: [], ...parts });
}

export function standAt(world: World, x: number, groundY = 500): void {
  world.player.x = x; world.player.y = groundY - world.player.height; world.player.vy = 0; world.player.grounded = true;
}

// 고정 스텝 하나(1/60초)와 자주 쓰는 입력. 여러 테스트 파일이 같은 정의를 각자 두던 것을 모았다.
export const dt = 1 / 60;
export const idle: InputState = { horizontal: 0, jumpPressed: false, restartPressed: false };
export const right: InputState = { horizontal: 1, jumpPressed: false, restartPressed: false };
export const left: InputState = { horizontal: -1, jumpPressed: false, restartPressed: false };

// input을 누른 채 steps 스텝까지, 또는 stop()이 참이 될 때까지 진행한다.
export function runUntil(world: World, input: InputState, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}
