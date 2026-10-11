import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { FALLING_PLATFORMS, GOAL, HAZARDS } from '../../../src/game/world/level';

const noInput = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const dt = 1 / 60;

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
