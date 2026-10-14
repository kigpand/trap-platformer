import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import {
  AMBUSH_ENEMIES, CHECKPOINTS, CONDITIONAL_TRAPS, ENEMIES, FALLING_PLATFORMS, GOAL, HAZARDS, HIDDEN_BLOCKS, SOLIDS,
} from '../../../src/game/world/level';
import type { Rect } from '../../../src/game/physics/AABB';
import type { Player } from '../../../src/game/entities/Player';

const noInput = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const dt = 1 / 60;

// 텔레포트 없이 실제 입력만으로 레벨을 통과시키는 보수적인 자동 플레이어.
// 서 있는 발판의 가장자리(간격 포함)나 전방의 위험 요소(위험지대·적 등 solids에 넣지 않은
// 것)가 가까워지면 점프한다 — 숙련된 플레이어의 "엣지 점프"와 달리 약간 더 일찍 뛰어 중간
// 발판에도 착지한다. obstacles는 매 프레임 다시 계산해서 넘기면 움직이는 적에도 반응한다.
function shouldJump(player: Player, solids: readonly Rect[], obstacles: readonly Rect[]): boolean {
  if (!player.grounded) return false;
  const standingOn = solids.find(
    (s) => player.x < s.x + s.width && player.x + player.width > s.x && Math.abs(player.y + player.height - s.y) < 1,
  );
  const edgeDistance = standingOn ? standingOn.x + standingOn.width - (player.x + player.width) : -1;
  const upcomingObstacle = obstacles.some((h) => h.x >= player.x + player.width && h.x - (player.x + player.width) < 20);
  return standingOn === undefined || edgeDistance < 20 || upcomingObstacle;
}

describe('World trap and goal rules', () => {
  it('resets with a counted death when touching a hazard', () => {
    const world = new World();
    const hazard = HAZARDS[0];
    world.player.x = hazard.x + 1;
    world.player.y = hazard.y - world.player.height + 1;
    world.update(dt, noInput);
    expect(world.deaths).toBe(1);
    expect(world.player.x).toBe(65);
  });

  it('marks the level cleared on reaching the goal', () => {
    const world = new World();
    world.player.x = GOAL.x;
    world.player.y = GOAL.y;
    world.update(dt, noInput);
    expect(world.snapshot().cleared).toBe(true);
  });

  it('collapses a falling platform after the trigger delay once stood on', () => {
    const world = new World();
    const platform = FALLING_PLATFORMS[0];
    world.player.x = platform.x + 10;
    world.player.y = platform.y - world.player.height;
    world.player.grounded = true;
    for (let i = 0; i < 60; i++) world.update(dt, noInput);
    expect(world.fallingPlatforms[0].solid).toBe(false);
  });

  it('keeps a falling platform solid for a player standing on it under the trigger delay', () => {
    const world = new World();
    const platform = FALLING_PLATFORMS[0];
    world.player.x = platform.x + 10;
    world.player.y = platform.y - world.player.height;
    world.player.grounded = true;
    for (let i = 0; i < 10; i++) world.update(dt, noInput); // 10/60s < 0.4s delay
    expect(world.fallingPlatforms[0].solid).toBe(true);
  });

  it('blocks a jump on the frame right after a falling platform collapses underneath the player', () => {
    const world = new World();
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
    const world = new World();
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
    const world = new World();
    const block = HIDDEN_BLOCKS[0];
    world.player.x = block.x + 10;
    world.player.y = block.y - world.player.height;
    world.player.grounded = true;
    for (let i = 0; i < 15; i++) world.update(dt, noInput); // 15/60s > 0.2s delay
    expect(world.hiddenBlocks[0].solid).toBe(false);
  });

  it('also collapses a hidden block on side contact, not just standing on top', () => {
    const world = new World();
    const block = HIDDEN_BLOCKS[0];
    world.player.x = block.x - world.player.width; // flush against the left edge
    world.player.y = block.y + 20; // mid-height, not resting on top
    world.player.grounded = false;
    world.update(dt, noInput);
    expect(world.hiddenBlocks[0].timer).not.toBeNull();
  });

  it('opens a real pit once a hidden block collapses, causing a fall death', () => {
    const world = new World();
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
    const world = new World();
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
    const world = new World();
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
    const world = new World();
    const enemy = world.enemies[0];
    world.player.x = enemy.x;
    world.player.y = enemy.y;
    world.update(dt, noInput);
    expect(world.deaths).toBe(1);
    expect(world.player.x).toBe(65);
  });

  it('enemy patrols back and forth without being pushed by the player', () => {
    const world = new World();
    const enemy = world.enemies[0];
    const startX = enemy.x;
    for (let i = 0; i < 300; i++) world.update(dt, noInput);
    // 플레이어와 멀리 떨어져 있으므로 충돌 없이 자유롭게 왕복한다 — 범위를 벗어나지 않아야 한다.
    expect(world.enemies[0].x).toBeGreaterThanOrEqual(ENEMIES[0].minX);
    expect(world.enemies[0].x + world.enemies[0].width).toBeLessThanOrEqual(ENEMIES[0].maxX);
    expect(world.enemies[0].x).not.toBe(startX);
  });

  it('resets enemy patrol position and direction on restart', () => {
    const world = new World();
    for (let i = 0; i < 60; i++) world.update(dt, noInput); // let it move away from minX
    expect(world.enemies[0].x).not.toBe(ENEMIES[0].minX);
    world.update(dt, { ...noInput, restartPressed: true });
    expect(world.enemies[0].x).toBe(ENEMIES[0].minX);
    expect(world.enemies[0].vx).toBeGreaterThan(0);
  });

  it('reaches and collides with the enemy using only movement and jump input (no teleporting)', () => {
    const world = new World();
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
    const world = new World();
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
    const world = new World();
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
    const world = new World();
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
    const world = new World();
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
    const world = new World();
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
    const world = new World();
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
    const world = new World();
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
    const world = new World();
    const zone = CONDITIONAL_TRAPS[0].zone;
    world.player.x = zone.x + 1;
    world.player.y = zone.y + 1;
    for (let i = 0; i < 40; i++) world.update(dt, noInput);
    expect(world.conditionalTraps[0].dwellTime).toBeGreaterThan(0);
    world.update(dt, { ...noInput, restartPressed: true });
    expect(world.conditionalTraps[0].dwellTime).toBe(0);
  });

  it('reaches the goal from spawn through every trap using only movement and jump input (no teleporting)', () => {
    // 개별 함정별 reachability 테스트는 각자 그 함정 직전에서 시작해 특정 구간만 검증한다.
    // Codex 리뷰: 그것만으로는 스폰부터 끝까지 "살아서" 통과 가능한지 보장하지 않는다는 지적을
    // 받아, 생성 지점부터 모든 함정·적·목표를 실제 입력만으로 통과하는 테스트를 복원한다.
    const world = new World();
    const input = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
    for (let i = 0; i < 1500 && !world.cleared; i++) {
      const solids = [...SOLIDS, ...world.fallingPlatforms.filter((fp) => fp.solid).map((fp) => fp.rect)];
      const spawnedAmbushes = world.ambushes.flatMap((a) => (a.enemy ? [a.enemy] : []));
      const obstacles = [...HAZARDS, ...world.enemies, ...spawnedAmbushes];
      input.jumpPressed = shouldJump(world.player, solids, obstacles);
      world.update(dt, input);
    }
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(0);
    expect(world.activeCheckpoint).not.toBeNull(); // 가는 길에 체크포인트도 실제로 밟았어야 한다
  });

  it('sets the active checkpoint on contact', () => {
    const world = new World();
    const cp = CHECKPOINTS[0];
    world.player.x = cp.zone.x + 1;
    world.player.y = cp.zone.y + 1;
    world.update(dt, noInput);
    expect(world.activeCheckpoint).toEqual({ x: cp.respawnX, y: cp.respawnY });
    expect(world.snapshot().checkpoint).toBe(true);
  });

  it('respawns at the checkpoint (not the level start) after a death once one was reached', () => {
    const world = new World();
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
    const world = new World();
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
    const world = new World();
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
