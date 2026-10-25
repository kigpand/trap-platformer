import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { LEVEL_1, LEVEL_2 } from '../../../src/game/world/level';
import { runToGoal } from './autopilot';

// 레벨 2 배치 검증(docs/roadmap.md "새 맵 추가" 릴리스 3번). 처음 작성 당시엔 진행 흐름(4번) 전이라 게임 화면에서 고를 수 없어,
// World에 LEVEL_2를 직접 넘겨 확인한다.
const dt = 1 / 60;
const noInput = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const [groundA, groundB] = LEVEL_2.solids;
const platform = LEVEL_2.fallingPlatforms[0];
const hazard = LEVEL_2.hazards[0];
const checkpoint = LEVEL_2.checkpoints[0];
const ambush = LEVEL_2.ambushes[0];

function standOn(world: World, x: number, groundY: number): void {
  world.player.x = x;
  world.player.y = groundY - world.player.height;
  world.player.grounded = true;
}

describe('LEVEL_2', () => {
  it('uses at least three trap kinds plus a patrol enemy, in a different combination from level 1', () => {
    const kinds = (level: typeof LEVEL_1) => [
      level.hiddenBlocks.length > 0 && 'hiddenBlock', level.fallingPlatforms.length > 0 && 'fallingPlatform',
      level.ambushes.length > 0 && 'ambush', level.hazards.length > 0 && 'fakeSafeZone', level.conditionalTraps.length > 0 && 'conditional',
    ].filter(Boolean);
    expect(kinds(LEVEL_2).length).toBeGreaterThanOrEqual(3);
    expect(LEVEL_2.enemies.length).toBeGreaterThan(0);
    expect(kinds(LEVEL_2)).not.toEqual(kinds(LEVEL_1));
  });

  it('reaches the goal from spawn using only movement and jump input (no teleporting), passing the checkpoint', () => {
    const world = new World(LEVEL_2);
    runToGoal(world);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(0);
    expect(world.activeCheckpoint).toEqual({ x: checkpoint.respawnX, y: checkpoint.respawnY });
  });

  it('requires the falling platform: the pit is too wide to jump without it', () => {
    const world = new World(LEVEL_2);
    for (const fp of world.fallingPlatforms) fp.solid = false; // 발판이 없다고 가정
    runToGoal(world, 300);
    expect(world.deaths).toBeGreaterThan(0);
    expect(groundB.x - (groundA.x + groundA.width)).toBeGreaterThan(147); // 평지 점프 최대 수평 거리(physics-spec)보다 넓다
  });

  it('collapses the falling platform under a player who stays on it, dropping them into the pit', () => {
    const world = new World(LEVEL_2);
    standOn(world, platform.x + 20, platform.y);
    for (let i = 0; i < 30 && world.fallingPlatforms[0].solid; i++) world.update(dt, noInput);
    expect(world.fallingPlatforms[0].solid).toBe(false); // 0.4초 유예 뒤 붕괴(사망하면 레벨이 초기화되므로 먼저 확인)
    for (let i = 0; i < 120 && world.deaths === 0; i++) world.update(dt, noInput);
    expect(world.deaths).toBe(1); // 구덩이로 떨어져 낙사
  });

  it('spawns the ambush enemy after its warning once the trigger is entered', () => {
    const world = new World(LEVEL_2);
    standOn(world, ambush.trigger.x, groundB.y);
    world.update(dt, noInput);
    expect(world.ambushes[0].warningTimer).not.toBeNull();
    for (let i = 0; i < 20; i++) world.update(dt, noInput);
    expect(world.ambushes[0].enemy).not.toBeNull();
  });

  it('respawns at the checkpoint after the fake safe zone, with the highlight on screen, and can still finish holding right', () => {
    const world = new World(LEVEL_2);
    standOn(world, checkpoint.zone.x + 1, groundB.y);
    world.update(dt, noInput);
    standOn(world, hazard.x + 1, groundB.y);
    world.update(dt, noInput);
    expect(world.deaths).toBe(1);
    expect(world.player.x).toBe(checkpoint.respawnX);
    expect(world.hazardReveal?.rect).toBe(hazard);
    for (let i = 0; i < 120; i++) world.update(dt, noInput); // 재시작 위치에서 위험지대가 보이므로 2초 뒤 해제
    expect(world.hazardReveal).toBeNull();
    // 체크포인트에서 재시작한 직후 →를 누른 채로도 위험지대·왕복 적에 매번 같은 타이밍으로 걸리는
    // 무한 사망 루프 없이 끝까지 갈 수 있다(재시작하면 적의 순찰 위치도 초기화되므로 늘 같은 상황이 된다).
    world.reset(true);
    runToGoal(world);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(2); // 위험지대 1회 + 위에서 직접 호출한 재시작 1회, 그 뒤로는 추가 사망 없음
  });

  it('has a checkpoint before the fake safe zone that a running jump cannot skip', () => {
    expect(checkpoint.zone.x + checkpoint.zone.width).toBeLessThan(hazard.x);
    for (let start = checkpoint.zone.x - 160; start <= checkpoint.zone.x - 30; start += 5) {
      const world = new World(LEVEL_2);
      world.enemies = []; world.ambushes = []; // 점프 궤적만 검증한다
      standOn(world, start, groundB.y);
      world.update(dt, { horizontal: 1, jumpPressed: true, restartPressed: false });
      for (let i = 0; i < 90 && world.player.x < checkpoint.zone.x + checkpoint.zone.width + 10; i++) {
        world.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
      }
      expect(world.activeCheckpoint, `jump started at x=${start}`).not.toBeNull();
    }
  });
});
