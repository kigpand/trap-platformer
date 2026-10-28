import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { LEVEL_3, LEVELS } from '../../../src/game/world/level';
import { jumpSkyDropHeadOn, playSolution, type Step } from './solution';

// 레벨 3(어려움, 16,800px): 새 함정 8종을 명세 기본 크기로 쉴 틈 없이 이어 붙인다(함정 확장 릴리스 6번).
// 원래 구간이 없어 처음부터 끝까지 해법 입력으로 간다. 맵 3배 확장: 예전 마지막 구간(도망가는 목표)을 끝으로 옮기고,
// 그 사이에 약올리는 함정·함정 추가 17종(14~30번)을 둘씩 섞어 둔다.
const dt = 1 / 60;
const VANISH_SPIKES: Step[] = [{ run: 935 }, { jump: true }]; // 사라지는 땅을 달리다 그대로 가시(트리거 앞 10px 구간)
const INVISIBLE_BLOCK: Step[] = [{ run: 1262 }, { jump: true }]; // 가장자리 46~24px 앞(23px)에서 일찍 뛴다
const SKY_DROPS_1: Step[] = [
  { run: 1454 }, { left: 10 }, // 트리거만 밟고 조금 물러선다(뒤는 투명 블록 구덩이)
  { waitUntil: (w) => w.skyDrops[0].enemies.every((se) => se.phase === 'patrolling') },
  { run: 1540 }, ...jumpSkyDropHeadOn(0, 0), { run: 1780 }, ...jumpSkyDropHeadOn(0, 1),
];
const FAKE_CEILING_SPIKES: Step[] = [
  { run: 2258 }, { jump: true }, // 높이 60px 가짜 체크포인트(출발 구간 12px)
  { run: 2445 }, { right: 4 }, { left: 20 }, { wait: 1 }, { run: 2475 }, { jump: true }, // 천장을 떨어뜨리고 넘는다
  { run: 2634 }, { jump: true }, // 착지하자마자 두 번째 가시
];
const DODGE: Step[] = [{ run: 2898 }, { hop: true }, { wait: 0.3 }, { jump: true }, { run: 3070 }, { jump: true }];
const VANISH_HAZARD: Step[] = [{ run: 3815 }, { jump: true }]; // 두 번째 사라지는 땅 끝(3800) 바로 뒤에서 가짜 안전지대(3840)를 넘는다
const SKY_DROPS_2: Step[] = [
  { run: 4204 }, { left: 10 }, { waitUntil: (w) => w.skyDrops[1].enemies.every((se) => se.phase === 'patrolling') },
  { run: 4340 }, ...jumpSkyDropHeadOn(1, 0), { run: 4580 }, ...jumpSkyDropHeadOn(1, 1),
];
const mirror = (w: World) => w.mirrorEnemies[0];
const arrowNear = (i: number) => (w: World) => { const a = w.arrowTraps[0].arrows[i]; return a.phase === 'flying' && a.x <= w.player.x + w.player.width + 40; };
const BOULDER_WALL: Step[] = [{ run: 4985 }, { jump: true }, { run: 6295 }, { jump: true }]; // 돌덩이를 달고 가짜 벽을 그대로 지나 구덩이
const ICE_FLING: Step[] = [{ run: 6865 }, { jump: true }, { run: 7375 }, { jump: true }]; // 뒤쪽 구덩이, 얼음 끝 날려버리는 점프 구역 앞에서 뛴다
const SHADOW_REVERSE: Step[] = [{ runUntil: (w) => w.reverse !== null }, { leftUntil: (w) => w.reverse === null }, { run: 8295 }, { jump: true }];
const ARROWS_HEAVY: Step[] = [
  { run: 9330 }, { waitUntil: arrowNear(0) }, { hop: true }, // 낮은 화살
  { waitUntil: (w) => w.arrowTraps[0].arrows[1].phase === 'gone' }, // 높은 화살은 서서
  { waitUntil: arrowNear(2) }, { hop: true }, { waitUntil: (w) => w.arrowTraps[0].arrows[2].phase === 'gone' }, // 다시 낮은 화살
  { run: 9975 }, { jump: true }, // 무거운 신발 구역 앞에서
];
const MIRROR_SPIKES: Step[] = [
  { run: 10380 }, { waitUntil: (w) => mirror(w).enemy.vx > 0 && mirror(w).enemy.x >= 10750 }, { run: 10620 },
  { waitUntil: (w) => mirror(w).enemy.vx < 0 && mirror(w).enemy.x - (w.player.x + w.player.width) <= 40 }, { hop: true },
  { waitUntil: (w) => !mirror(w).airborne && mirror(w).enemy.x + mirror(w).enemy.width < w.player.x - 10 },
  { run: 11215 }, { jump: true }, // "여기서 점프!" 표지판 말과 달리 구역 앞에서 뛰어 턱 위로
];
const COUNTING: Step[] = [{ run: 11615 }, { jump: true }, { run: 11900 }, { jump: true }]; // 발끝까지 버티다 늦게 뛰어 두 번만 착지
const RHYTHM: Step[] = [{ run: 13398 }, { waitUntil: (w) => w.lifeTime % 1.8 < 1 / 60 }, { jump: true }, { jump: true }, { jump: true }, { jump: true }];
const CEILING_FAKE_SPRING: Step[] = [{ run: 15685 }, { jump: true }]; // 천장 통로·두 번째 가짜 클리어를 멈추지 않고 지나 스프링을 넘는다
const FINALE: Step[] = [{ run: 16185 }, { jump: true }, { run: 16534 }, { jump: true }, { run: 16760 }]; // 도망가는 목표·구덩이·가시
const TAUNTING: Step[] = [...BOULDER_WALL, ...ICE_FLING, ...SHADOW_REVERSE, ...ARROWS_HEAVY, ...MIRROR_SPIKES, ...COUNTING, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE];
const FULL: Step[] = [...VANISH_SPIKES, ...INVISIBLE_BLOCK, ...SKY_DROPS_1, ...FAKE_CEILING_SPIKES, ...DODGE, ...VANISH_HAZARD, ...SKY_DROPS_2, ...TAUNTING];

function respawnAt(index: number): World {
  const cp = LEVEL_3.checkpoints[index];
  const world = new World(LEVEL_3);
  world.activeCheckpoint = { x: cp.respawnX, y: cp.respawnY };
  world.reset(true);
  return world;
}

describe('LEVEL_3 (hard)', () => {
  it('is the last level, the longest, and uses all eight new trap kinds at the spec sizes', () => {
    expect(LEVELS[LEVELS.length - 1]).toBe(LEVEL_3);
    expect(LEVEL_3.width).toBeGreaterThan(Math.max(...LEVELS.slice(0, -1).map((l) => l.width))); // 맵 3배 확장을 마쳐 다시 가장 길다
    const kinds = [LEVEL_3.vanishingGrounds, LEVEL_3.invisibleBlocks, LEVEL_3.fallingCeilings, LEVEL_3.dodgingPlatforms,
      LEVEL_3.popUpSpikes, LEVEL_3.fakeCheckpoints, LEVEL_3.goalHops, LEVEL_3.skyDrops];
    expect(kinds.every((list) => list.length > 0)).toBe(true);
    expect(LEVEL_3.popUpSpikes.every((sp) => sp.spikes.width === 40 && sp.spikes.height === 24)).toBe(true);
    expect(LEVEL_3.fakeCheckpoints.every((f) => f.height === 60)).toBe(true);
  });

  it('mixes in every taunting and added trap kind (14-30)', () => {
    const kinds = [LEVEL_3.fakeGoals, LEVEL_3.flingZones, LEVEL_3.reverseZones, LEVEL_3.springFloors, LEVEL_3.signs, LEVEL_3.boulders,
      LEVEL_3.fakeWalls, LEVEL_3.baitGems, LEVEL_3.shadows, LEVEL_3.landingSpikeZones, LEVEL_3.heavyZones, LEVEL_3.descendingCeilings,
      LEVEL_3.arrowTraps, LEVEL_3.rhythmPlatforms, LEVEL_3.iceFloors, LEVEL_3.mirrorEnemies, LEVEL_3.countingPlatforms];
    expect(kinds.every((list) => list.length > 0)).toBe(true);
    expect(LEVEL_3.width).toBe(16800);
  });

  it('can be finished from spawn with the solution inputs and no deaths', () => {
    const world = new World(LEVEL_3);
    expect(playSolution(world, FULL)).toBe(FULL.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(0);
    expect(world.goal.rect).toEqual(LEVEL_3.goalHops[LEVEL_3.goalHops.length - 1].to);
  });

  it.each([
    ['checkpoint 1 (before the invisible block)', 0, [{ wait: 0.6 }, ...INVISIBLE_BLOCK, ...SKY_DROPS_1, ...FAKE_CEILING_SPIKES, ...DODGE, ...VANISH_HAZARD, ...SKY_DROPS_2, ...TAUNTING]],
    ['checkpoint 2 (before the fake checkpoint)', 1, [{ wait: 0.6 }, ...FAKE_CEILING_SPIKES, ...DODGE, ...VANISH_HAZARD, ...SKY_DROPS_2, ...TAUNTING]],
    ['checkpoint 3 (before the second vanishing ground)', 2, [{ wait: 0.6 }, ...VANISH_HAZARD, ...SKY_DROPS_2, ...TAUNTING]],
    ['checkpoint 4 (before the second sky drops)', 3, [{ wait: 0.6 }, ...SKY_DROPS_2, ...TAUNTING]],
    ['checkpoint 5 (boulder and fake wall)', 4, [{ run: 6295 }, { jump: true }, ...ICE_FLING, ...SHADOW_REVERSE, ...ARROWS_HEAVY, ...MIRROR_SPIKES, ...COUNTING, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 6 (ice and fling jump)', 5, [...ICE_FLING, ...SHADOW_REVERSE, ...ARROWS_HEAVY, ...MIRROR_SPIKES, ...COUNTING, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 7 (shadow and reverse zone)', 6, [...SHADOW_REVERSE, ...ARROWS_HEAVY, ...MIRROR_SPIKES, ...COUNTING, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 8 (arrows and heavy shoes)', 7, [...ARROWS_HEAVY, ...MIRROR_SPIKES, ...COUNTING, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 9 (mirror enemy and landing spikes)', 8, [...MIRROR_SPIKES, ...COUNTING, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 10 (third-landing platform)', 9, [...COUNTING, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 11 (rhythm platforms)', 10, [...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 12 (ceiling, second fake clear, spring)', 11, [...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 13 (spring)', 12, [...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 14 (fleeing goal)', 13, FINALE],
  ] as const)('can be finished from %s with no further deaths', (_, index, steps) => {
    const world = respawnAt(index);
    expect(playSolution(world, steps)).toBe(steps.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(1);
  });

  it('gets past the sky drops whatever the timing of arrival', () => {
    // 체크포인트 1에서 출발 전 대기 시간을 바꿔, 쏟아지는 적 구간에 도착하는 시점을 고르게 바꿔 본다.
    for (let delay = 0; delay < 90; delay += 9) {
      const world = respawnAt(0);
      const steps: Step[] = [{ wait: 0.6 + delay / 60 }, ...INVISIBLE_BLOCK, ...SKY_DROPS_1, { run: 2050 }];
      expect(playSolution(world, steps), `waited ${delay} extra steps`).toBe(steps.length);
    }
  });

  it('catches the natural approach at its traps', () => {
    // 투명 블록: 가장자리에서 뛰면 찧고 떨어진다
    const a = respawnAt(0);
    playSolution(a, [{ wait: 0.6 }, { run: 1296 }]);
    a.update(dt, { horizontal: 1, jumpPressed: true, restartPressed: false });
    for (let i = 0; i < 200 && a.deaths === 1; i++) a.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
    expect(a.deathCause?.rect).toBe(LEVEL_3.invisibleBlocks[0]);
    // 쏟아지는 적: 트리거를 밟고 그대로 달리면 맞는다
    const b = respawnAt(3);
    for (let i = 0; i < 400 && b.deaths === 1; i++) b.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
    expect(b.deaths).toBe(2);
    expect(b.deathCause?.rect.x).toBe(LEVEL_3.skyDrops[1].trigger.x);
  });

  it('catches the naive play at each new pairing', () => {
    const step = (w: World, horizontal: -1 | 0 | 1, jumpPressed = false) => w.update(dt, { horizontal, jumpPressed, restartPressed: false });
    const until = (w: World, horizontal: -1 | 0 | 1, stop: () => boolean) => { for (let i = 0; i < 1500 && !stop(); i++) step(w, horizontal); };
    const dies = (w: World, kind: string) => { expect(w.deaths, kind).toBe(2); expect(w.snapshot().deathKind).toBe(kind); };
    // 가짜 벽: 막힌 줄 알고 멈추면 돌덩이에 깔린다
    const wall = respawnAt(4);
    until(wall, 1, () => wall.player.x + wall.player.width >= LEVEL_3.fakeWalls[0].x);
    until(wall, 0, () => wall.deaths > 1);
    dies(wall, 'boulder');
    // 얼음 끝 날려버리는 점프: 미끄러지는 얼음 끝(구역 안)에서 뛰면 뒤쪽 구덩이로 날아간다
    const fling = respawnAt(5);
    playSolution(fling, [{ run: 6865 }, { jump: true }, { run: 7392 }]);
    step(fling, 1, true); until(fling, 1, () => fling.deaths > 1);
    dies(fling, 'flingJump');
    // 그림자 안 반전: 반전에 당황해 멈추면 그림자에 잡힌다
    const reverse = respawnAt(6);
    playSolution(reverse, [{ runUntil: (w) => w.reverse !== null }]);
    until(reverse, 0, () => reverse.deaths > 1);
    dies(reverse, 'shadow');
    // 무거운 신발: 화살을 피한 뒤 구덩이 가장자리(구역 안)에서 뛰면 못 건넌다
    const heavy = respawnAt(7);
    playSolution(heavy, ARROWS_HEAVY.slice(0, -2));
    playSolution(heavy, [{ run: 9995 }]);
    step(heavy, 1, true); until(heavy, 1, () => heavy.deaths > 1);
    dies(heavy, 'heavyShoes');
    // 착지 예측 가시: "여기서 점프!" 표지판 말대로 구역 안에서 뛰면 착지 지점에 가시
    const sign = respawnAt(8);
    playSolution(sign, [...MIRROR_SPIKES.slice(0, -2), { run: 11260 }]);
    step(sign, 1, true); until(sign, 1, () => sign.deaths > 1);
    dies(sign, 'landingSpikes');
    // 박자 발판: 박자를 보지 않고 늦게 올라타 머뭇거리면 사라진다
    const rhythm = respawnAt(10);
    playSolution(rhythm, [{ run: 13398 }, { waitUntil: (w) => w.lifeTime % 1.8 > 0.15 && w.lifeTime % 1.8 < 0.2 }, { jump: true }]);
    until(rhythm, 0, () => rhythm.deaths > 1);
    dies(rhythm, 'rhythmPlatform');
    // 두 번째 가짜 클리어: "진짜 끝!" 깃발에서 다음 레벨을 누르면 떨어진다
    const fake = respawnAt(11);
    playSolution(fake, [{ run: LEVEL_3.fakeGoals[0].flag.x + 10 }]);
    expect(fake.snapshot().cleared).toBe(true);
    fake.collapseFakeFloor();
    until(fake, 0, () => fake.deaths > 1);
    dies(fake, 'fakeClear');
  });

  it('flings back into the pit behind from anywhere in the fling zone at the end of the ice', () => {
    const zone = LEVEL_3.flingZones[0].zone;
    for (let x = zone.x - 25; x < zone.x + zone.width; x++) {
      const world = respawnAt(5);
      world.player.x = x; world.player.y = 468; world.player.vy = 0; world.player.grounded = true; world.player.vx = 210;
      world.update(dt, { horizontal: 1, jumpPressed: true, restartPressed: false });
      for (let i = 0; i < 300 && world.deaths === 1; i++) world.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
      expect(world.snapshot().deathKind, `x ${x}`).toBe('flingJump');
    }
  });
});
