import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { LEVEL_1, LEVEL_2 } from '../../../src/game/world/level';
import { runToGoal } from './autopilot';
import { playSolution, type Step } from './solution';
import { AFTER_CP2, ARROWS, BOULDER, COUNTING, DODGE, FLEEING_GOAL, FULL, HEAVY, LANDING_SPIKES, mirror, MIRROR, REVERSE, SPIKES_AND_FAKE, TAUNTING, VANISHING_CEILING_ENEMY } from './level2Solution';
import { dt } from './fixtures';
import { respawnFrom } from './respawn';

// 레벨 2 배치 검증(docs/history.md "새 맵 추가" 릴리스 3번). 처음 작성 당시엔 진행 흐름(4번) 전이라 게임 화면에서 고를 수 없어,
// World에 LEVEL_2를 직접 넘겨 확인한다.
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

// 레벨 2(보통, 15,300px) 해법. 원래 구간은 보이는 것만 피하면 되므로 자동 플레이로 가고, 함정 확장 구간은
// 해법 입력으로 간다(docs/traps-spec.md 공통 규칙). 구간별로 나눠 체크포인트 재시작 테스트에서 이어 쓴다.
// 맵 3배 확장: 예전 끝(도망가는 목표)을 레벨 끝으로 옮기고, 그 사이에 날려버리는 점프 → 좌우 반전 → 무거운 신발 →
// 착지 예측 가시 → 화살 → 따라 뛰는 적 → 세 번째 착지 발판 → 따라오는 돌덩이를 하나씩 둔다.
const cpGoal = LEVEL_2.checkpoints[LEVEL_2.checkpoints.length - 1]; // 도망가는 목표 앞

const respawnAt = (cp: (typeof LEVEL_2.checkpoints)[number]): World => respawnFrom(LEVEL_2, cp);

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

  it('is about three times its old 5100px and adds the taunting traps not used in level 1', () => {
    expect(LEVEL_2.width).toBe(15300);
    const taunting = [LEVEL_2.flingZones, LEVEL_2.reverseZones, LEVEL_2.boulders, LEVEL_2.landingSpikeZones, LEVEL_2.heavyZones,
      LEVEL_2.arrowTraps, LEVEL_2.mirrorEnemies, LEVEL_2.countingPlatforms];
    expect(taunting.every((list) => list.length > 0)).toBe(true);
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
    ['checkpoint 3 (before the spikes and fake checkpoint)', 2, [{ wait: 0.6 }, ...SPIKES_AND_FAKE, ...VANISHING_CEILING_ENEMY, ...DODGE, ...TAUNTING]],
    ['checkpoint 4 (before the falling ceiling)', 3, [{ wait: 0.6 }, ...VANISHING_CEILING_ENEMY, ...DODGE, ...TAUNTING]],
    ['checkpoint 5 (before the fling jump)', 4, TAUNTING],
    ['checkpoint 6 (before the reverse zone)', 5, [...REVERSE, ...HEAVY, ...LANDING_SPIKES, ...ARROWS, ...MIRROR, ...COUNTING, ...BOULDER, ...FLEEING_GOAL]],
    ['checkpoint 7 (before the heavy shoes)', 6, [...HEAVY, ...LANDING_SPIKES, ...ARROWS, ...MIRROR, ...COUNTING, ...BOULDER, ...FLEEING_GOAL]],
    ['checkpoint 8 (before the landing spikes)', 7, [...LANDING_SPIKES, ...ARROWS, ...MIRROR, ...COUNTING, ...BOULDER, ...FLEEING_GOAL]],
    ['checkpoint 9 (before the arrows)', 8, [...ARROWS, ...MIRROR, ...COUNTING, ...BOULDER, ...FLEEING_GOAL]],
    ['checkpoint 10 (before the mirror enemy)', 9, [...MIRROR, ...COUNTING, ...BOULDER, ...FLEEING_GOAL]],
    ['checkpoint 11 (before the third-landing platform)', 10, [...COUNTING, ...BOULDER, ...FLEEING_GOAL]],
    ['checkpoint 12 (before the boulder)', 11, [...BOULDER, ...FLEEING_GOAL]],
    ['checkpoint 13 (before the fleeing goal)', 12, FLEEING_GOAL],
  ] as const)('can be finished from %s with no further deaths', (_, index, steps) => {
    const world = respawnAt(LEVEL_2.checkpoints[index]);
    expect(playSolution(world, steps)).toBe(steps.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(1);
  });

  it('ends with the goal at its last hop spot after both hops', () => {
    // 코덱스 리뷰: 두 번째 이동이 깨져 목표가 첫 도착지(4840)에 남아도, 해법이 그 위를 지나가며 클리어해 완주 테스트가 통과했다.
    const world = new World(LEVEL_2);
    expect(playSolution(world, FULL)).toBe(FULL.length);
    expect(world.goal.hopIndex).toBe(LEVEL_2.goalHops.length);
    expect(world.goal.rect).toEqual(LEVEL_2.goalHops[LEVEL_2.goalHops.length - 1].to);
  });

  it('gets past the second patrol enemy whatever its patrol phase on arrival', () => {
    // 코덱스 리뷰: 해법이 적의 순찰 위상에 따라 죽었다 — 멀어지는 적을 뒤에서 따라잡아 뛰면 적 위로 떨어진다.
    // 체크포인트 4에서 출발 전 대기 시간을 바꿔 도착 시점의 위상을 고르게 바꿔 본다(순찰 왕복 약 1.2초).
    for (let delay = 0; delay < 90; delay += 5) {
      const world = respawnAt(LEVEL_2.checkpoints[3]);
      const steps: Step[] = [{ wait: 0.6 + delay / 60 }, ...VANISHING_CEILING_ENEMY, ...DODGE, { run: 4300 }];
      expect(playSolution(world, steps), `waited ${delay} extra steps`).toBe(steps.length);
      expect(world.deaths).toBe(1); // 체크포인트로 보낸 사망뿐 — 적을 넘고 도망가는 발판 너머에 닿았다
    }
  });

  it('makes the invisible block catch a natural edge jump, and the fleeing goal run away from a direct chase', () => {
    const block = LEVEL_2.invisibleBlocks[0];
    const a = respawnAt(LEVEL_2.checkpoints[1]);
    playSolution(a, [{ run: 2140 }]); // 가장자리까지 가서 뛴다
    a.update(dt, { horizontal: 1, jumpPressed: true, restartPressed: false });
    for (let i = 0; i < 200 && a.deaths === 1; i++) a.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
    expect(a.deathCause?.rect).toBe(block);
    const b = respawnAt(cpGoal);
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

  it('catches the naive play at each taunting trap', () => {
    const step = (w: World, horizontal: -1 | 0 | 1, jumpPressed = false) => w.update(dt, { horizontal, jumpPressed, restartPressed: false });
    const until = (w: World, horizontal: -1 | 0 | 1, stop: () => boolean) => { for (let i = 0; i < 1500 && !stop(); i++) step(w, horizontal); };
    const cp = (i: number) => respawnAt(LEVEL_2.checkpoints[i]);
    const dies = (w: World, kind: string) => { expect(w.deaths).toBe(2); expect(w.snapshot().deathKind).toBe(kind); };
    // 날려버리는 점프: 구덩이 가장자리(구역 안)에서 뛰면 뒤쪽 구덩이로 날아간다
    const fling = cp(4);
    playSolution(fling, [{ run: 4395 }, { jump: true }, { run: 4630 }, { jump: true }, { run: 4890 }]); // 가운데 파이프(4650)는 넘는다
    step(fling, 1, true); until(fling, 1, () => fling.deaths > 1);
    dies(fling, 'flingJump');
    // 좌우 반전: 걸린 뒤에도 →를 누르면 구역 경계에서 들락날락할 뿐 지나가지 못한다(구역 안에서만 반전 — 2026-11-08 결정)
    const reverse = cp(5);
    const zone = LEVEL_2.reverseZones[0];
    for (let i = 0; i < 600; i++) step(reverse, 1);
    expect(reverse.deaths).toBe(1);
    expect(reverse.player.x).toBeLessThan(zone.x + zone.width);
    // 무거운 신발: 구덩이 가장자리(구역 안)에서 뛰면 못 건넌다
    const heavy = cp(6);
    playSolution(heavy, [{ run: 6195 }]);
    step(heavy, 1, true); until(heavy, 1, () => heavy.deaths > 1);
    dies(heavy, 'heavyShoes');
    // 착지 예측 가시: 턱 바로 앞(구역 안)에서 뛰면 착지 지점에 가시가 솟는다
    const spikes = cp(7);
    playSolution(spikes, [{ run: 6690 }]);
    step(spikes, 1, true); until(spikes, 1, () => spikes.deaths > 1);
    dies(spikes, 'landingSpikes');
    // 화살: 트리거에 서 있으면 낮은 화살에 맞는다
    const arrow = cp(8);
    playSolution(arrow, [{ run: 7430 }]);
    until(arrow, 0, () => arrow.deaths > 1);
    dies(arrow, 'arrow');
    // 따라 뛰는 적: 마주 오는 적을 보통처럼 달려가며 넘으려 하면 같이 뛰어 부딪힌다
    const mirrorRun = cp(9);
    playSolution(mirrorRun, [{ run: 8780 }, { waitUntil: (w) => mirror(w).enemy.vx < 0 && mirror(w).enemy.x < 9000 }]);
    playSolution(mirrorRun, [{ runUntil: (w) => mirror(w).enemy.x - (w.player.x + w.player.width) <= 30 }, { jump: true }]);
    until(mirrorRun, 1, () => mirrorRun.deaths > 1);
    dies(mirrorRun, 'mirrorEnemy');
    // 세 번째 착지 발판: 구덩이 끝에서 바로 뛰면 발판 착지 → 장애물 두 번으로 세 번째 착지에 무너진다
    const counting = cp(10);
    playSolution(counting, [{ run: 10100 }, { jump: true }, { run: 10240 }, { jump: true }, { run: 10400 }, { jump: true }]);
    until(counting, 0, () => counting.deaths > 1);
    dies(counting, 'countingPlatform');
    // 가라앉는 파이프(#32): 반전을 빠져나간 뒤 파이프 위에 올라서 머뭇거리면 아래 틈으로 떨어진다
    const sink = cp(5);
    const sp = LEVEL_2.sinkingPipes[0].pipe;
    playSolution(sink, [...REVERSE.slice(0, 2), { run: sp.x }]); // 파이프 옆면까지 걸어가
    step(sink, 1, true); for (let i = 0; i < 18; i++) step(sink, 1); // 뛰어서 파이프 위로만 옮겨 가고
    until(sink, 0, () => sink.player.grounded);
    expect(sink.player.y + sink.player.height).toBe(sp.y); // 파이프 위에 섰다
    until(sink, 0, () => sink.deaths > 1);
    dies(sink, 'sinkingPipe');
    // 적이 나오는 파이프(#31): 세 번째 착지 발판을 건너 그대로 땅으로 달려가면 나온 적에 부딪힌다
    const pipe = cp(10);
    playSolution(pipe, COUNTING.slice(0, 4));
    until(pipe, 1, () => pipe.deaths > 1);
    dies(pipe, 'pipeEnemy');
    // 따라오는 돌덩이: 트리거를 지나 멈추면 깔린다
    const boulder = cp(11);
    playSolution(boulder, [{ run: 11760 }]);
    until(boulder, 0, () => boulder.deaths > 1);
    dies(boulder, 'boulder');
  });

  it('flings back far enough to land in the pit behind, from anywhere in the fling zone', () => {
    // traps-spec #15 배치 제약: 날아간 궤적이 뒤쪽 구덩이(4400-4500)에 떨어져야 함정이 된다(넘어가 안전한 바닥에 떨어지면 함정이 아니다).
    const zone = LEVEL_2.flingZones[0].zone;
    for (let x = zone.x - 25; x < zone.x + zone.width; x++) {
      const world = respawnAt(LEVEL_2.checkpoints[4]);
      world.player.x = x; world.player.y = 468; world.player.vy = 0; world.player.grounded = true;
      world.update(dt, { horizontal: 1, jumpPressed: true, restartPressed: false });
      for (let i = 0; i < 300 && world.deaths === 1; i++) world.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
      expect(world.snapshot().deathKind, `x ${x}`).toBe('flingJump');
    }
  });
});
