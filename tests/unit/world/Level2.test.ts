import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { LEVEL_1, LEVEL_2 } from '../../../src/game/world/level';
import { runToGoal } from './autopilot';
import { playSolution, type Step } from './solution';

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

// 레벨 2(보통, 5,100px) 해법. 원래 구간은 보이는 것만 피하면 되므로 자동 플레이로 가고, 함정 확장 구간은
// 해법 입력으로 간다(docs/traps-spec.md 공통 규칙). 구간별로 나눠 체크포인트 재시작 테스트에서 이어 쓴다.
const cp5 = LEVEL_2.checkpoints[4]; // 도망가는 목표 앞
const ORIGINAL: Step[] = [{ auto: 2060 }]; // 낙하 발판 → 갑자기 출현하는 적 → 체크포인트 → 가짜 안전지대 → 왕복 적 → 체크포인트 2
const INVISIBLE_BLOCK: Step[] = [{ run: 2100 }, { jump: true }]; // 가장자리보다 일찍 뛰어 투명 블록 아래로
const SPIKES_AND_FAKE: Step[] = [
  { run: 2490 }, { jump: true }, // 24px 가시: 솟기 전에 트리거·가시를 함께 넘는다
  { run: 2740 }, { jump: true }, // 높이 50px 가짜 체크포인트를 넘는다(출발 구간 29px, 실측)
];
const VANISHING_CEILING_ENEMY: Step[] = [
  { run: 3500 }, // 사라지는 땅은 달려서 지난다
  { right: 4 }, { left: 20 }, { wait: 1 }, { run: 3535 }, { jump: true }, // 천장을 먼저 떨어뜨리고 넘는다
  // 왕복 적: 마주 오면 일찍(45px 앞) 뛴다 — 보이는 것만 피하는 자동 플레이(20px 앞)로는 마주 오는 적을 못 넘는다.
  { runUntil: (w) => { const e = w.enemies[1]; const gap = e.x - (w.player.x + w.player.width); return w.player.grounded && gap <= 45 && gap > -e.width; } },
  { jump: true },
];
const DODGE: Step[] = [{ run: 3898 }, { hop: true }, { wait: 0.3 }, { jump: true }, { run: 4070 }, { jump: true }];
const FLEEING_GOAL: Step[] = [{ run: 4410 }, { wait: 0.4 }, { run: 4580 }, { jump: true }, { run: 5080 }];
const AFTER_CP2: Step[] = [...INVISIBLE_BLOCK, ...SPIKES_AND_FAKE, ...VANISHING_CEILING_ENEMY, ...DODGE, ...FLEEING_GOAL];
const FULL: Step[] = [...ORIGINAL, ...AFTER_CP2];

function respawnAt(cp: (typeof LEVEL_2.checkpoints)[number]): World {
  const world = new World(LEVEL_2);
  world.activeCheckpoint = { x: cp.respawnX, y: cp.respawnY };
  world.reset(true);
  return world;
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

  it('is much longer than before and uses all seven new trap kinds', () => {
    expect(LEVEL_2.width).toBeGreaterThanOrEqual(5000);
    const counts = [LEVEL_2.vanishingGrounds, LEVEL_2.invisibleBlocks, LEVEL_2.fallingCeilings, LEVEL_2.dodgingPlatforms,
      LEVEL_2.popUpSpikes, LEVEL_2.fakeCheckpoints, LEVEL_2.goalHops].map((list) => list.length);
    expect(counts.every((n) => n > 0)).toBe(true);
  });

  it('reaches the goal from spawn with the solution inputs (no teleporting), passing every checkpoint', () => {
    const world = new World(LEVEL_2);
    expect(playSolution(world, FULL)).toBe(FULL.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(0);
    const last = LEVEL_2.checkpoints[LEVEL_2.checkpoints.length - 1];
    expect(world.activeCheckpoint).toEqual({ x: last.respawnX, y: last.respawnY });
  });

  it.each([
    ['checkpoint 2 (before the invisible block)', 1, AFTER_CP2],
    ['checkpoint 3 (before the spikes and fake checkpoint)', 2, [{ wait: 0.6 }, ...SPIKES_AND_FAKE, ...VANISHING_CEILING_ENEMY, ...DODGE, ...FLEEING_GOAL]],
    ['checkpoint 4 (before the falling ceiling)', 3, [{ wait: 0.6 }, ...VANISHING_CEILING_ENEMY, ...DODGE, ...FLEEING_GOAL]],
    ['checkpoint 5 (before the fleeing goal)', 4, FLEEING_GOAL],
  ] as const)('can be finished from %s with no further deaths', (_, index, steps) => {
    const world = respawnAt(LEVEL_2.checkpoints[index]);
    expect(playSolution(world, steps)).toBe(steps.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(1);
  });

  it('makes the invisible block catch a natural edge jump, and the fleeing goal run away from a direct chase', () => {
    const block = LEVEL_2.invisibleBlocks[0];
    const a = respawnAt(LEVEL_2.checkpoints[1]);
    playSolution(a, [{ run: 2140 }]); // 가장자리까지 가서 뛴다
    a.update(dt, { horizontal: 1, jumpPressed: true, restartPressed: false });
    for (let i = 0; i < 200 && a.deaths === 1; i++) a.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
    expect(a.deathCause?.rect).toBe(block);
    const b = respawnAt(cp5);
    for (let i = 0; i < 400 && b.deaths === 1 && !b.cleared; i++) b.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
    expect(b.cleared).toBe(false); // →만 누르면 도망간 목표를 쫓다 구덩이에 빠진다
    expect(b.deathCause?.rect.x).toBe(LEVEL_2.goalHops[0].trigger.x);
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
    expect(world.deathCause?.rect).toBe(hazard);
    for (let i = 0; i < 120; i++) world.update(dt, noInput); // 재시작 위치에서 위험지대가 보이므로 2초 뒤 해제
    expect(world.deathCause).toBeNull();
    // 체크포인트에서 재시작한 직후 →를 누른 채로도 위험지대·왕복 적에 매번 같은 타이밍으로 걸리는
    // 무한 사망 루프 없이 끝까지 갈 수 있다(재시작하면 적의 순찰 위치도 초기화되므로 늘 같은 상황이 된다).
    world.reset(true);
    expect(playSolution(world, FULL)).toBe(FULL.length); // 원래 구간은 →를 누른 채 자동 플레이로 지나간다
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
