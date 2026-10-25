import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { LEVEL_1, LEVEL_2 } from '../../../src/game/world/level';
import { shouldJump } from './autopilot';
import { playSolution } from './solution';

// 이 파일의 테스트는 레벨 1의 배치를 검증한다. 레벨 객체 도입 전의 이름을 그대로 써서 테스트 본문은 바꾸지 않는다.
const {
  ambushes: AMBUSH_ENEMIES, checkpoints: CHECKPOINTS, conditionalTraps: CONDITIONAL_TRAPS, enemies: ENEMIES,
  fallingPlatforms: FALLING_PLATFORMS, goal: GOAL, hazards: HAZARDS, hiddenBlocks: HIDDEN_BLOCKS, solids: SOLIDS,
} = LEVEL_1;
const noInput = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const dt = 1 / 60;

describe('World trap and goal rules', () => {
  it('updates facing on horizontal input and keeps it while idle', () => {
    const world = new World(LEVEL_1);
    expect(world.player.facing).toBe(1); // 기본값(오른쪽)
    world.update(dt, { horizontal: -1, jumpPressed: false, restartPressed: false });
    expect(world.player.facing).toBe(-1);
    world.update(dt, noInput); // 입력이 없어도 마지막으로 바라본 방향을 유지해야 한다
    expect(world.player.facing).toBe(-1);
    world.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
    expect(world.player.facing).toBe(1);
  });

  it('resets with a counted death when touching a hazard', () => {
    const world = new World(LEVEL_1);
    const hazard = HAZARDS[0];
    world.player.x = hazard.x + 1;
    world.player.y = hazard.y - world.player.height + 1;
    world.update(dt, noInput);
    expect(world.deaths).toBe(1);
    expect(world.player.x).toBe(65);
  });

  it('marks the level cleared on reaching the goal', () => {
    const world = new World(LEVEL_1);
    world.player.x = GOAL.x;
    world.player.y = GOAL.y;
    world.update(dt, noInput);
    expect(world.snapshot().cleared).toBe(true);
  });

  it('collapses a falling platform after the trigger delay once stood on', () => {
    const world = new World(LEVEL_1);
    const platform = FALLING_PLATFORMS[0];
    world.player.x = platform.x + 10;
    world.player.y = platform.y - world.player.height;
    world.player.grounded = true;
    for (let i = 0; i < 60; i++) world.update(dt, noInput);
    expect(world.fallingPlatforms[0].solid).toBe(false);
  });

  it('keeps a falling platform solid for a player standing on it under the trigger delay', () => {
    const world = new World(LEVEL_1);
    const platform = FALLING_PLATFORMS[0];
    world.player.x = platform.x + 10;
    world.player.y = platform.y - world.player.height;
    world.player.grounded = true;
    for (let i = 0; i < 10; i++) world.update(dt, noInput); // 10/60s < 0.4s delay
    expect(world.fallingPlatforms[0].solid).toBe(true);
  });

  it('blocks a jump on the frame right after a falling platform collapses underneath the player', () => {
    const world = new World(LEVEL_1);
    const platform = FALLING_PLATFORMS[0];
    world.player.x = platform.x + 10;
    world.player.y = platform.y - world.player.height;
    world.player.grounded = true;
    let frames = 0;
    while (world.fallingPlatforms[0].solid) {
      world.update(dt, noInput);
      if (++frames > 120) throw new Error('platform never collapsed within 2s');
    }
    world.update(dt, { ...noInput, jumpPressed: true });
    expect(world.player.vy).toBeGreaterThanOrEqual(0);
    expect(world.player.grounded).toBe(false);
  });

  it('reaches the falling platform using only movement and jump input (no teleporting)', () => {
    const world = new World(LEVEL_1);
    // 숨겨진 블록 틈(300-380)과 적 구간(700-850)은 각자 전용 reachability 테스트가 있다 —
    // 이 테스트는 이동+점프만으로 낙하 발판에 "실제로 도달·발동"하는지만 검증하므로,
    // 그 함정들을 넘긴 지점(ground2, 적 구간 이후)에서 출발한다.
    world.player.x = 900;
    world.player.y = 468;
    world.player.grounded = true;
    const input = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
    let triggered = false;
    for (let i = 0; i < 600 && !triggered; i++) {
      const solids = [...SOLIDS, ...world.fallingPlatforms.filter((fp) => fp.solid).map((fp) => fp.rect)];
      input.jumpPressed = shouldJump(world.player, solids, HAZARDS);
      world.update(dt, input);
      if (world.fallingPlatforms[0].timer !== null) triggered = true;
    }
    expect(triggered).toBe(true);
    expect(world.deaths).toBe(0);
  });

  it('collapses a hidden block after standing on top of it', () => {
    const world = new World(LEVEL_1);
    const block = HIDDEN_BLOCKS[0];
    world.player.x = block.x + 10;
    world.player.y = block.y - world.player.height;
    world.player.grounded = true;
    for (let i = 0; i < 15; i++) world.update(dt, noInput); // 15/60s > 0.2s delay
    expect(world.hiddenBlocks[0].solid).toBe(false);
  });

  it('also collapses a hidden block on side contact, not just standing on top', () => {
    const world = new World(LEVEL_1);
    const block = HIDDEN_BLOCKS[0];
    world.player.x = block.x - world.player.width; // flush against the left edge
    world.player.y = block.y + 20; // mid-height, not resting on top
    world.player.grounded = false;
    world.update(dt, noInput);
    expect(world.hiddenBlocks[0].timer).not.toBeNull();
  });

  it('opens a real pit once a hidden block collapses, causing a fall death', () => {
    const world = new World(LEVEL_1);
    const block = HIDDEN_BLOCKS[0];
    world.player.x = block.x + 10;
    world.player.y = block.y - world.player.height;
    world.player.grounded = true;
    for (let i = 0; i < 15; i++) world.update(dt, noInput);
    expect(world.hiddenBlocks[0].solid).toBe(false);
    for (let i = 0; i < 60 && world.deaths === 0; i++) world.update(dt, noInput);
    expect(world.deaths).toBe(1);
  });

  it('still allows a jump when the player straddles a collapsing block and adjacent solid ground', () => {
    // Codex 리뷰 재현: ground1a(0-300)와 숨겨진 블록(300-380) 경계에 걸쳐 서 있다가
    // 블록이 붕괴하는 바로 그 프레임에 점프하면, ground1a가 여전히 받치고 있으므로 점프가 되어야 한다.
    const world = new World(LEVEL_1);
    world.player.x = 278.5; // right edge(304.5)가 ground1a(300)와 숨겨진 블록을 동시에 걸침
    world.player.y = 468;
    world.player.grounded = true;
    let frames = 0;
    while (world.hiddenBlocks[0].solid) {
      const aboutToCollapse = world.hiddenBlocks[0].timer !== null && world.hiddenBlocks[0].timer - dt <= 0;
      world.update(dt, { horizontal: 0, jumpPressed: aboutToCollapse, restartPressed: false });
      if (++frames > 60) throw new Error('block never collapsed within 1s');
    }
    expect(world.player.vy).toBeLessThan(0); // 점프가 실제로 적용됐어야 한다
    expect(world.player.y).toBeLessThan(468); // 위로 움직였어야 한다
  });

  it('reaches and triggers the hidden block from spawn by walking only (no teleporting)', () => {
    const world = new World(LEVEL_1);
    const input = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
    let triggered = false;
    for (let i = 0; i < 300 && !triggered; i++) {
      world.update(dt, input);
      if (world.hiddenBlocks[0].timer !== null) triggered = true;
    }
    expect(triggered).toBe(true);
    expect(world.deaths).toBe(0);
  });

  it('resets with a counted death when touching an enemy', () => {
    const world = new World(LEVEL_1);
    const enemy = world.enemies[0];
    world.player.x = enemy.x;
    world.player.y = enemy.y;
    world.update(dt, noInput);
    expect(world.deaths).toBe(1);
    expect(world.player.x).toBe(65);
  });

  it('enemy patrols back and forth without being pushed by the player', () => {
    const world = new World(LEVEL_1);
    const enemy = world.enemies[0];
    const startX = enemy.x;
    for (let i = 0; i < 300; i++) world.update(dt, noInput);
    // 플레이어와 멀리 떨어져 있으므로 충돌 없이 자유롭게 왕복한다 — 범위를 벗어나지 않아야 한다.
    expect(world.enemies[0].x).toBeGreaterThanOrEqual(ENEMIES[0].minX);
    expect(world.enemies[0].x + world.enemies[0].width).toBeLessThanOrEqual(ENEMIES[0].maxX);
    expect(world.enemies[0].x).not.toBe(startX);
  });

  it('resets enemy patrol position and direction on restart', () => {
    const world = new World(LEVEL_1);
    for (let i = 0; i < 60; i++) world.update(dt, noInput); // let it move away from minX
    expect(world.enemies[0].x).not.toBe(ENEMIES[0].minX);
    world.update(dt, { ...noInput, restartPressed: true });
    expect(world.enemies[0].x).toBe(ENEMIES[0].minX);
    expect(world.enemies[0].vx).toBeGreaterThan(0);
  });

  it('reaches and collides with the enemy using only movement and jump input (no teleporting)', () => {
    const world = new World(LEVEL_1);
    // 숨겨진 블록(300-380)은 밟으면 반드시 붕괴하는 함정이라 직선 보행 테스트와는 별개로
    // "reaches and triggers the hidden block" 테스트로 이미 검증했다 — 여기서는 그 틈을 넘어선
    // 지점(400)에서 출발해 gap1(520-620)을 점프로 건너 적 구간(700-850)까지 도달하는지 검증한다.
    world.player.x = 400;
    world.player.y = 468;
    world.player.grounded = true;
    const input = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
    let reachedZone = false;
    let collided = false;
    for (let i = 0; i < 300 && !collided; i++) {
      const solids = [...SOLIDS, ...world.fallingPlatforms.filter((fp) => fp.solid).map((fp) => fp.rect)];
      input.jumpPressed = shouldJump(world.player, solids, HAZARDS);
      world.update(dt, input);
      if (world.player.x >= ENEMIES[0].minX) reachedZone = true;
      if (world.deaths > 0) collided = true;
    }
    expect(reachedZone).toBe(true);
    expect(collided).toBe(true);
  });

  it('spawns the ambush enemy after the warning delay once the trigger zone is entered', () => {
    const world = new World(LEVEL_1);
    const { trigger, minX, y } = AMBUSH_ENEMIES[0];
    world.player.x = trigger.x + 1;
    world.player.y = trigger.y + 1;
    world.player.grounded = false;
    world.update(dt, noInput);
    expect(world.ambushes[0].warningTimer).not.toBeNull();
    expect(world.ambushes[0].enemy).toBeNull();
    for (let i = 0; i < 20 && !world.ambushes[0].enemy; i++) world.update(dt, noInput);
    expect(world.ambushes[0].enemy).not.toBeNull();
    expect(world.ambushes[0].enemy?.x).toBe(minX);
    expect(world.ambushes[0].enemy?.y).toBe(y);
  });

  it('resets with a counted death when touching a spawned ambush enemy', () => {
    const world = new World(LEVEL_1);
    const { trigger } = AMBUSH_ENEMIES[0];
    world.player.x = trigger.x + 1;
    world.player.y = trigger.y + 1;
    world.player.grounded = false;
    for (let i = 0; i < 20 && !world.ambushes[0].enemy; i++) world.update(dt, noInput);
    const enemy = world.ambushes[0].enemy;
    if (!enemy) throw new Error('ambush enemy did not spawn');
    world.player.x = enemy.x;
    world.player.y = enemy.y;
    world.update(dt, noInput);
    expect(world.deaths).toBe(1);
  });

  it('resets ambush trigger and spawned enemy on restart', () => {
    const world = new World(LEVEL_1);
    const { trigger } = AMBUSH_ENEMIES[0];
    world.player.x = trigger.x + 1;
    world.player.y = trigger.y + 1;
    world.player.grounded = false;
    for (let i = 0; i < 20 && !world.ambushes[0].enemy; i++) world.update(dt, noInput);
    expect(world.ambushes[0].enemy).not.toBeNull();
    world.update(dt, { ...noInput, restartPressed: true });
    expect(world.ambushes[0].enemy).toBeNull();
    expect(world.ambushes[0].warningTimer).toBeNull();
  });

  it('reaches and collides with the ambush enemy using only movement and jump input (no teleporting)', () => {
    const world = new World(LEVEL_1);
    // 낙하 발판 구간(ground2~ground3)은 전용 테스트로 이미 검증했으므로, 그 다리를 건넌 지점(1350)
    // 에서 출발해 실제로 트리거를 지나 등장한 적과 충돌하는지만 검증한다.
    world.player.x = 1350;
    world.player.y = 468;
    world.player.grounded = true;
    const input = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
    let sawWarning = false;
    let collided = false;
    for (let i = 0; i < 300 && !collided; i++) {
      const solids = [...SOLIDS, ...world.fallingPlatforms.filter((fp) => fp.solid).map((fp) => fp.rect)];
      input.jumpPressed = shouldJump(world.player, solids, HAZARDS);
      world.update(dt, input);
      if (world.ambushes[0].warningTimer !== null) sawWarning = true;
      if (world.deaths > 0) collided = true;
    }
    expect(sawWarning).toBe(true);
    expect(collided).toBe(true);
  });

  it('triggers the conditional trap only after dwelling past the threshold', () => {
    const world = new World(LEVEL_1);
    const zone = CONDITIONAL_TRAPS[0].zone;
    world.player.x = zone.x + 1;
    world.player.y = zone.y + 1;
    // 59프레임(< 1초)까지는 안전해야 한다.
    for (let i = 0; i < 59; i++) {
      world.update(dt, noInput);
      expect(world.deaths).toBe(0);
    }
    world.update(dt, noInput); // 60번째 프레임(1초)에서 발동
    expect(world.deaths).toBe(1);
  });

  it('resets dwell time when the player leaves the conditional trap zone before the threshold', () => {
    const world = new World(LEVEL_1);
    const zone = CONDITIONAL_TRAPS[0].zone;
    world.player.x = zone.x + 1;
    world.player.y = zone.y + 1;
    for (let i = 0; i < 40; i++) world.update(dt, noInput); // 0.67s 체류, 아직 안전
    world.player.x = zone.x - 100; // 영역 이탈
    world.update(dt, noInput);
    expect(world.deaths).toBe(0);
    world.player.x = zone.x + 1; // 재진입 — 누적되지 않고 처음부터 다시 세어야 한다
    for (let i = 0; i < 40; i++) world.update(dt, noInput);
    expect(world.deaths).toBe(0);
  });

  it('passing through the conditional trap zone quickly is safe', () => {
    const world = new World(LEVEL_1);
    const zone = CONDITIONAL_TRAPS[0].zone;
    world.player.x = zone.x - 10;
    world.player.y = 468;
    world.player.grounded = true;
    const input = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
    for (let i = 0; i < 60; i++) world.update(dt, input); // 1초간 평범하게 걸어서 통과
    expect(world.deaths).toBe(0);
    expect(world.player.x).toBeGreaterThan(zone.x + zone.width);
  });

  it('resets conditional trap dwell time on restart', () => {
    const world = new World(LEVEL_1);
    const zone = CONDITIONAL_TRAPS[0].zone;
    world.player.x = zone.x + 1;
    world.player.y = zone.y + 1;
    for (let i = 0; i < 40; i++) world.update(dt, noInput);
    expect(world.conditionalTraps[0].dwellTime).toBeGreaterThan(0);
    world.update(dt, { ...noInput, restartPressed: true });
    expect(world.conditionalTraps[0].dwellTime).toBe(0);
  });

  it('passes every original trap from spawn using only movement and jump input (no teleporting)', () => {
    // 개별 함정별 reachability 테스트는 각자 그 함정 직전에서 시작해 특정 구간만 검증한다.
    // Codex 리뷰: 그것만으로는 스폰부터 끝까지 "살아서" 통과 가능한지 보장하지 않는다는 지적을
    // 받아, 생성 지점부터 실제 입력만으로 통과하는 테스트를 둔다. 레벨 1이 트롤 함정 구간까지 길어진 뒤로는
    // 보이는 함정만 피하는 자동 플레이로 원래 구간(사라지는 땅 직전까지)을 검증하고, 목표까지의 완주는
    // 해법 입력으로 Level1.test.ts에서 검증한다.
    const world = new World(LEVEL_1);
    expect(playSolution(world, [{ auto: 1940 }])).toBe(1);
    expect(world.deaths).toBe(0);
    expect(world.activeCheckpoint).not.toBeNull(); // 가는 길에 체크포인트도 실제로 밟았어야 한다
  });

  it('sets the active checkpoint on contact', () => {
    const world = new World(LEVEL_1);
    const cp = CHECKPOINTS[0];
    world.player.x = cp.zone.x + 1;
    world.player.y = cp.zone.y + 1;
    world.update(dt, noInput);
    expect(world.activeCheckpoint).toEqual({ x: cp.respawnX, y: cp.respawnY });
    expect(world.snapshot().checkpoint).toBe(true);
  });

  it('respawns at the checkpoint (not the level start) after a death once one was reached', () => {
    const world = new World(LEVEL_1);
    const cp = CHECKPOINTS[0];
    world.player.x = cp.zone.x + 1;
    world.player.y = cp.zone.y + 1;
    world.update(dt, noInput);
    // 체크포인트를 지난 뒤 위험지대에서 사망
    const hazard = HAZARDS[0];
    world.player.x = hazard.x + 1;
    world.player.y = hazard.y - world.player.height + 1;
    world.update(dt, noInput);
    expect(world.deaths).toBe(1);
    expect(world.player.x).toBe(cp.respawnX);
    expect(world.player.y).toBe(cp.respawnY);
  });

  it('manual restart (R) clears the checkpoint and respawns at the level start', () => {
    const world = new World(LEVEL_1);
    const cp = CHECKPOINTS[0];
    world.player.x = cp.zone.x + 1;
    world.player.y = cp.zone.y + 1;
    world.update(dt, noInput);
    expect(world.activeCheckpoint).not.toBeNull();
    world.update(dt, { ...noInput, restartPressed: true });
    expect(world.activeCheckpoint).toBeNull();
    expect(world.player.x).toBe(65);
    expect(world.player.y).toBe(350);
  });

  it('resets falling platform, hidden block, and cleared state on restart', () => {
    const world = new World(LEVEL_1);
    world.player.x = GOAL.x;
    world.player.y = GOAL.y;
    world.update(dt, noInput);
    expect(world.cleared).toBe(true);
    const block = HIDDEN_BLOCKS[0];
    world.player.x = block.x + 10;
    world.player.y = block.y - world.player.height;
    world.player.grounded = true;
    for (let i = 0; i < 15; i++) world.update(dt, noInput);
    expect(world.hiddenBlocks[0].solid).toBe(false);
    world.update(dt, { ...noInput, restartPressed: true });
    expect(world.cleared).toBe(false);
    expect(world.hiddenBlocks[0].solid).toBe(true);
  });
});

describe('World sound events', () => {
  it('reports a jump only when the jump actually happens (grounded)', () => {
    const world = new World(LEVEL_1);
    world.update(dt, { ...noInput, jumpPressed: true }); // 스폰 직후는 공중이라 점프가 일어나지 않는다
    expect(world.drainEvents()).toEqual([]);
    world.player.x = 100;
    world.player.y = SOLIDS[0].y - world.player.height;
    world.player.grounded = true;
    world.update(dt, { ...noInput, jumpPressed: true });
    expect(world.drainEvents()).toEqual(['jump']);
  });

  it('reports a death, and drainEvents empties the queue', () => {
    const world = new World(LEVEL_1);
    const hazard = HAZARDS[0];
    world.player.x = hazard.x + 1;
    world.player.y = hazard.y - world.player.height + 1;
    world.update(dt, noInput);
    expect(world.drainEvents()).toEqual(['death']);
    expect(world.drainEvents()).toEqual([]);
  });

  it('does not report a death on manual restart', () => {
    const world = new World(LEVEL_1);
    world.update(dt, { ...noInput, restartPressed: true });
    expect(world.drainEvents()).toEqual([]);
  });

  it('reports a checkpoint only when it is newly activated, not every frame inside the zone', () => {
    const world = new World(LEVEL_1);
    const cp = CHECKPOINTS[0];
    world.player.x = cp.zone.x + 1;
    world.player.y = cp.zone.y + 1;
    world.update(dt, noInput);
    expect(world.drainEvents()).toContain('checkpoint');
    world.player.x = cp.zone.x + 1;
    world.player.y = cp.zone.y + 1;
    world.update(dt, noInput);
    expect(world.drainEvents()).not.toContain('checkpoint');
  });

  it('reports the clear once, not on every frame spent at the goal', () => {
    const world = new World(LEVEL_1);
    world.player.x = GOAL.x;
    world.player.y = GOAL.y;
    world.update(dt, noInput);
    expect(world.drainEvents()).toEqual(['clear']);
    world.player.x = GOAL.x;
    world.player.y = GOAL.y;
    world.update(dt, noInput);
    expect(world.drainEvents()).toEqual([]);
  });
});

describe('World run time and run deaths (best record inputs)', () => {
  it('accumulates run time per fixed step and reports it in tenths of a second', () => {
    const world = new World(LEVEL_1);
    for (let i = 0; i < 60; i++) world.update(dt, noInput);
    expect(world.snapshot().time).toBe(1); // 1/60 누적 오차로 0.9가 되지 않는다
  });

  it('keeps the run going through a death: time keeps counting and only this run\'s deaths are counted', () => {
    const world = new World(LEVEL_1);
    for (let i = 0; i < 30; i++) world.update(dt, noInput);
    const hazard = HAZARDS[0];
    world.player.x = hazard.x + 1;
    world.player.y = hazard.y - world.player.height + 1;
    world.update(dt, noInput);
    expect(world.snapshot().runDeaths).toBe(1);
    expect(world.runTime).toBeCloseTo(31 / 60);
  });

  it('manual restart starts a new run but keeps the lifetime FALLS counter', () => {
    const world = new World(LEVEL_1);
    const hazard = HAZARDS[0];
    world.player.x = hazard.x + 1;
    world.player.y = hazard.y - world.player.height + 1;
    world.update(dt, noInput);
    world.update(dt, { ...noInput, restartPressed: true });
    const snap = world.snapshot();
    expect(snap.time).toBe(0);
    expect(snap.runDeaths).toBe(0);
    expect(snap.deaths).toBe(1);
  });

  it('freezes the run once cleared: time stops and later deaths do not change the run result', () => {
    const world = new World(LEVEL_1);
    for (let i = 0; i < 30; i++) world.update(dt, noInput);
    world.player.x = GOAL.x;
    world.player.y = GOAL.y;
    world.update(dt, noInput);
    const atClear = world.snapshot();
    for (let i = 0; i < 30; i++) world.update(dt, noInput);
    const hazard = HAZARDS[0];
    world.player.x = hazard.x + 1;
    world.player.y = hazard.y - world.player.height + 1;
    world.update(dt, noInput);
    expect(world.snapshot().time).toBe(atClear.time);
    expect(world.snapshot().runDeaths).toBe(atClear.runDeaths);
  });
});

describe('fake safe zone reveal after death (docs/traps-spec.md #4)', () => {
  function dieOnHazard(world: World): void {
    const hazard = HAZARDS[0];
    world.player.x = hazard.x + 1;
    world.player.y = hazard.y - world.player.height + 1;
    world.update(dt, noInput);
  }

  it('highlights the hazard that caused the death right after respawn', () => {
    const world = new World(LEVEL_1);
    dieOnHazard(world);
    expect(world.deathCause?.rect).toBe(HAZARDS[0]);
  });

  function reachCheckpoint(world: World): void {
    const cp = CHECKPOINTS[0];
    world.player.x = cp.zone.x + 1;
    world.player.y = cp.zone.y + 1;
    world.update(dt, noInput);
  }

  it('clears the highlight after 2 seconds of play while the tile is on screen', () => {
    const world = new World(LEVEL_1);
    reachCheckpoint(world); // 체크포인트(950)에서 재시작하면 위험지대(1060)가 화면 안에 있다
    dieOnHazard(world);
    for (let i = 0; i < 119; i++) world.update(dt, noInput);
    expect(world.deathCause).not.toBeNull(); // 2초가 되기 직전까지는 유지
    world.update(dt, noInput);
    expect(world.deathCause).toBeNull();
  });

  it('manual restart (R) clears the highlight', () => {
    const world = new World(LEVEL_1);
    dieOnHazard(world);
    world.update(dt, { ...noInput, restartPressed: true });
    expect(world.deathCause).toBeNull();
  });

  it('a later death replaces an active highlight with that death\'s own cause', () => {
    // 공통 규칙 확장 전에는 다른 원인의 사망이 아무것도 표시하지 않았다 — 지금은 각자 자기 원인을 표시하고,
    // 새 사망은 이전 표시를 남기지 않고 바꾼다.
    const world = new World(LEVEL_1);
    dieOnHazard(world);
    expect(world.deathCause?.rect).toBe(HAZARDS[0]);
    const e = world.enemies[0];
    world.player.x = e.x;
    world.player.y = e.y;
    world.update(dt, noInput);
    expect(world.deathCause?.rect).toEqual({ x: ENEMIES[0].minX, y: ENEMIES[0].y, width: ENEMIES[0].maxX - ENEMIES[0].minX, height: 28 });
  });

  it('keeps the highlight while the tile is off screen and only counts down once it is visible', () => {
    // 코덱스 리뷰: 체크포인트를 건너뛰고 죽으면 시작점에서 재시작해 위험지대가 화면 밖에 있는데,
    // 2초가 그대로 흘러 플레이어가 보지 못한 채 표시가 사라졌다.
    const world = new World(LEVEL_1);
    dieOnHazard(world); // 체크포인트 없이 사망 → 시작점(65)에서 재시작, 위험지대(1060)는 화면 밖
    expect(world.activeCheckpoint).toBeNull();
    for (let i = 0; i < 240; i++) world.update(dt, noInput);
    expect(world.deathCause?.remaining).toBeCloseTo(2); // 화면 밖에서는 줄지 않는다
    world.player.x = 900; world.player.y = SOLIDS[2].y - world.player.height; // 위험지대가 보이는 곳까지 이동
    for (let i = 0; i < 120; i++) world.update(dt, noInput);
    expect(world.deathCause).toBeNull();
  });
});

describe('checkpoint placement before the fake safe zone', () => {
  it('cannot be jumped over: a running jump from any spot before it still reaches the checkpoint', () => {
    // 코덱스 리뷰: 실제 입력으로 체크포인트를 점프해 건너뛸 수 있어, 가짜 안전지대 사망 후 시작점에서 재시작했다.
    const cp = CHECKPOINTS[0];
    const ground = SOLIDS.find((s) => s.x <= cp.zone.x && s.x + s.width >= cp.zone.x + cp.zone.width);
    if (!ground) throw new Error('checkpoint is not over solid ground');
    for (let start = cp.zone.x - 160; start <= cp.zone.x - 30; start += 5) {
      const world = new World(LEVEL_1);
      world.enemies = []; world.ambushes = []; // 점프 궤적만 검증한다
      world.player.x = start;
      world.player.y = ground.y - world.player.height;
      world.player.grounded = true;
      world.update(dt, { horizontal: 1, jumpPressed: true, restartPressed: false });
      for (let i = 0; i < 90 && world.player.x < cp.zone.x + cp.zone.width + 10; i++) world.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
      expect(world.activeCheckpoint, `jump started at x=${start}`).not.toBeNull();
    }
  });
});


describe('death cause highlight for every trap (docs/traps-spec.md 공통 규칙)', () => {
  const fallUntilDeath = (world: World): void => {
    const before = world.deaths;
    for (let i = 0; i < 180 && world.deaths === before; i++) world.update(dt, noInput);
    expect(world.deaths).toBe(before + 1);
  };

  it('highlights a patrol enemy\'s range when it kills', () => {
    const world = new World(LEVEL_1);
    const e = world.enemies[0];
    world.player.x = e.x;
    world.player.y = e.y;
    world.update(dt, noInput);
    expect(world.deathCause?.rect).toEqual({ x: ENEMIES[0].minX, y: ENEMIES[0].y, width: ENEMIES[0].maxX - ENEMIES[0].minX, height: 28 });
  });

  it('highlights the ambush trigger and appearance range together when an ambush enemy kills', () => {
    const world = new World(LEVEL_1);
    const amb = AMBUSH_ENEMIES[0];
    world.player.x = amb.trigger.x;
    world.player.y = amb.trigger.y;
    for (let i = 0; i < 30 && world.ambushes[0].enemy === null; i++) world.update(dt, noInput);
    const enemy = world.ambushes[0].enemy;
    if (!enemy) throw new Error('ambush enemy did not appear');
    world.player.x = enemy.x;
    world.player.y = enemy.y;
    world.update(dt, noInput);
    const r = world.deathCause?.rect;
    expect(r).toBeDefined();
    expect(r!.x).toBe(Math.min(amb.trigger.x, amb.minX));
    expect(r!.x + r!.width).toBe(Math.max(amb.trigger.x + amb.trigger.width, amb.maxX));
  });

  it('highlights the conditional trap zone when it fires', () => {
    const world = new World(LEVEL_1);
    const zone = CONDITIONAL_TRAPS[0].zone;
    for (let i = 0; i < 90 && world.deaths === 0; i++) {
      world.player.x = zone.x + 5; world.player.y = zone.y + 5; world.player.vy = 0;
      world.update(dt, noInput);
    }
    expect(world.deathCause?.rect).toBe(zone);
  });

  it('blames a falling platform that collapsed within 3s of a fall death', () => {
    const world = new World(LEVEL_1);
    const fp = FALLING_PLATFORMS[0];
    world.player.x = fp.x + 20;
    world.player.y = fp.y - world.player.height;
    world.player.grounded = true;
    fallUntilDeath(world);
    expect(world.deathCause?.rect).toBe(fp);
  });

  it('blames a hidden block that collapsed within 3s of a fall death', () => {
    const world = new World(LEVEL_1);
    const hb = HIDDEN_BLOCKS[0];
    world.player.x = hb.x + 20;
    world.player.y = hb.y - world.player.height;
    world.player.grounded = true;
    fallUntilDeath(world);
    expect(world.deathCause?.rect).toBe(hb);
  });

  it('shows nothing for a plain pit fall with no trap involved', () => {
    const world = new World(LEVEL_2);
    world.player.x = 420; // 레벨 2 구덩이(400-640)의 낙하 발판(480-560) 앞쪽 빈 공간
    world.player.y = 480;
    fallUntilDeath(world);
    expect(world.deathCause).toBeNull();
  });

  it('does not blame a trap that collapsed more than 3s before the fall', () => {
    const world = new World(LEVEL_1);
    const hb = HIDDEN_BLOCKS[0];
    world.player.x = hb.x + 20; world.player.y = hb.y - world.player.height; world.player.grounded = true;
    for (let i = 0; i < 15 && world.hiddenBlocks[0].solid; i++) world.update(dt, noInput); // 0.2초 뒤 붕괴
    expect(world.hiddenBlocks[0].solid).toBe(false);
    const ground = SOLIDS[0];
    for (let i = 0; i < 200; i++) { // 3초 넘게 안전한 바닥에 서 있는다
      world.player.x = ground.x + 50; world.player.y = ground.y - world.player.height; world.player.vy = 0;
      world.update(dt, noInput);
    }
    world.player.x = hb.x + 20; world.player.y = hb.y; // 무너진 자리(구덩이)로 떨어진다
    fallUntilDeath(world);
    expect(world.deathCause).toBeNull();
  });
});
