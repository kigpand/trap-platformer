// 이 파일은 game 모듈을 타입으로만 가져온다(levelData 제외). level 모듈을 통째로 mock하는 테스트(FakeClearController.test.ts)가
// mock을 만드는 도중에 이 파일을 불러오므로, World·level을 런타임에 불러오면 만들어지는 중인 mock을 기다리며 멈춘다.
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
