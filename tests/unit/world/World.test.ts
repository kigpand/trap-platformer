import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { FALLING_PLATFORMS, GOAL, HAZARDS, SOLIDS } from '../../../src/game/world/level';
import type { Rect } from '../../../src/game/physics/AABB';
import type { Player } from '../../../src/game/entities/Player';

const noInput = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const dt = 1 / 60;

// 텔레포트 없이 실제 입력만으로 레벨을 통과시키는 보수적인 자동 플레이어.
// 서 있는 발판의 가장자리(간격 포함)나 전방 위험지대가 가까워지면 점프한다 —
// 숙련된 플레이어의 "엣지 점프"와 달리 약간 더 일찍 뛰어 중간 발판에도 착지한다.
function shouldJump(player: Player, solids: readonly Rect[], hazards: readonly Rect[]): boolean {
  if (!player.grounded) return false;
  const standingOn = solids.find(
    (s) => player.x < s.x + s.width && player.x + player.width > s.x && Math.abs(player.y + player.height - s.y) < 1,
  );
  const edgeDistance = standingOn ? standingOn.x + standingOn.width - (player.x + player.width) : -1;
  const upcomingHazard = hazards.some((h) => h.x >= player.x + player.width && h.x - (player.x + player.width) < 20);
  return standingOn === undefined || edgeDistance < 20 || upcomingHazard;
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

  it('reaches the falling platform from spawn using only movement and jump input (no teleporting)', () => {
    const world = new World();
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

  it('resets falling platform and cleared state on restart', () => {
    const world = new World();
    world.player.x = GOAL.x;
    world.player.y = GOAL.y;
    world.update(dt, noInput);
    expect(world.cleared).toBe(true);
    world.update(dt, { ...noInput, restartPressed: true });
    expect(world.cleared).toBe(false);
  });
});
