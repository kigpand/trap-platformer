import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { LEVEL_3, LEVELS } from '../../../src/game/world/level';
import { playSolution, type Step } from './solution';
import { ARROWS_HEAVY, CEILING_FAKE_SPRING, COUNTING, DODGE, FAKE_CEILING_SPIKES, FINALE, FULL, HILL_PIPE_ENEMY, ICE_FLING, INVISIBLE_BLOCK, MIRROR_SPIKES, RHYTHM, SHADOW_REVERSE, SKY_DROPS_1, SKY_DROPS_2, TAUNTING, VANISH_HAZARD } from './level3Solution';
import { dt } from './fixtures';
import { respawnFrom } from './respawn';

// 레벨 3(어려움, 16,800px): 새 함정 8종을 명세 기본 크기로 쉴 틈 없이 이어 붙인다(함정 확장 릴리스 6번).
// 원래 구간이 없어 처음부터 끝까지 해법 입력으로 간다. 맵 3배 확장: 예전 마지막 구간(도망가는 목표)을 끝으로 옮기고,
// 그 사이에 약올리는 함정·함정 추가 17종(14~30번)을 둘씩 섞어 둔다.

const respawnAt = (index: number): World => respawnFrom(LEVEL_3, LEVEL_3.checkpoints[index]);

describe('LEVEL_3 (hard)', () => {
  it('comes after levels 1-2, is longer than them, and uses all eight new trap kinds at the spec sizes', () => {
    // 마지막·가장 긴 레벨 확인은 레벨 4로 옮겼다(Level4.test.ts).
    expect(LEVELS.indexOf(LEVEL_3)).toBe(2);
    expect(LEVEL_3.width).toBeGreaterThan(Math.max(...LEVELS.slice(0, 2).map((l) => l.width)));
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
    ['checkpoint 5 (boulder and fake wall)', 4, [{ run: 6295 }, { jump: true }, ...ICE_FLING, ...SHADOW_REVERSE, ...ARROWS_HEAVY, ...MIRROR_SPIKES, ...COUNTING, ...HILL_PIPE_ENEMY, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 6 (ice and fling jump)', 5, [...ICE_FLING, ...SHADOW_REVERSE, ...ARROWS_HEAVY, ...MIRROR_SPIKES, ...COUNTING, ...HILL_PIPE_ENEMY, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 7 (shadow and reverse zone)', 6, [...SHADOW_REVERSE, ...ARROWS_HEAVY, ...MIRROR_SPIKES, ...COUNTING, ...HILL_PIPE_ENEMY, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 8 (arrows and heavy shoes)', 7, [...ARROWS_HEAVY, ...MIRROR_SPIKES, ...COUNTING, ...HILL_PIPE_ENEMY, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 9 (mirror enemy and landing spikes)', 8, [...MIRROR_SPIKES, ...COUNTING, ...HILL_PIPE_ENEMY, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 10 (third-landing platform)', 9, [...COUNTING, ...HILL_PIPE_ENEMY, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 11 (hill with the rolling stone, pipe enemy)', 10, [...HILL_PIPE_ENEMY, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 12 (rhythm platforms)', 11, [...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 13 (ceiling, second fake clear, spring)', 12, [...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 14 (spring)', 13, [...CEILING_FAKE_SPRING, ...FINALE]],
    ['checkpoint 15 (fleeing goal)', 14, FINALE],
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

  it('makes the one-way platform the only way over the pit before the spring', () => {
    // 위쪽으로만 갈 수 있는 길(2026-11-08): 발판을 빼면 구덩이 앞 가장자리 근처 어디서 뛰어도 떨어진다.
    const plat = LEVEL_3.oneWayPlatforms[0];
    const calm = { ...LEVEL_3, oneWayPlatforms: [] };
    for (let x = 15600 - 60; x < 15600; x++) {
      const world = new World(calm);
      world.player.x = x; world.player.y = 468; world.player.vy = 0; world.player.grounded = true;
      world.update(dt, { horizontal: 1, jumpPressed: true, restartPressed: false });
      for (let i = 0; i < 180 && world.deaths === 0; i++) world.update(dt, { horizontal: 1, jumpPressed: false, restartPressed: false });
      expect(world.deaths, `jump from x ${x}`).toBe(1);
    }
    expect(plat.x).toBeLessThan(15600);
    expect(plat.x + plat.width).toBeGreaterThan(15800);
  });

  it('still bounces the spring back onto flat ground (passing up through the platform)', () => {
    const world = respawnAt(13);
    playSolution(world, [...CEILING_FAKE_SPRING.slice(0, 2), { run: 15900 }]); // 발판에서 내려와 그대로 스프링으로
    for (let i = 0; i < 300 && (world.flight !== null || !world.player.grounded); i++) world.update(dt, { horizontal: 0, jumpPressed: false, restartPressed: false });
    expect(world.springFloors[0].bounced).toBe(true);
    expect(world.deaths).toBe(1); // 체크포인트로 보내려던 사망 1회뿐
    expect(world.player.y + world.player.height).toBe(500);
    expect(world.player.x).toBeLessThan(15500);
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
    playSolution(fling, [{ run: 6630 }, { jump: true }, { run: 6865 }, { jump: true }, { run: 7392 }]); // 앞의 파이프(6650)는 넘는다
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
    const rhythm = respawnAt(11);
    playSolution(rhythm, [{ run: 13398 }, { waitUntil: (w) => w.lifeTime % 1.8 > 0.15 && w.lifeTime % 1.8 < 0.2 }, { jump: true }]);
    until(rhythm, 0, () => rhythm.deaths > 1);
    dies(rhythm, 'rhythmPlatform');
    // 적이 나오는 파이프: 언덕을 내려와 멈추지 않고 파이프로 달려가면 내려오는 적에 닿는다
    const pipe = respawnAt(9);
    playSolution(pipe, [...COUNTING, ...HILL_PIPE_ENEMY.slice(0, 8)]);
    until(pipe, 1, () => pipe.deaths > 1);
    dies(pipe, 'pipeEnemy');
    // 굴러 내려오는 돌(#33): 언덕을 오르다 그대로 →를 누르고 있으면 굴러 내려오는 돌에 닿는다
    const stone = respawnAt(10);
    playSolution(stone, HILL_PIPE_ENEMY.slice(0, 2)); // 두 번째 단에 오른 뒤 그대로 →
    until(stone, 1, () => stone.deaths > 1);
    dies(stone, 'rollingStone');
    // 가라앉는 파이프(#32): 얼음 앞 파이프 위에 올라서 머뭇거리면 아래 틈으로 떨어진다
    const sink = respawnAt(5);
    const sp = LEVEL_3.sinkingPipes[0].pipe;
    playSolution(sink, [{ run: sp.x }]);
    step(sink, 1, true); for (let i = 0; i < 16; i++) step(sink, 1);
    until(sink, 0, () => sink.player.grounded);
    expect(sink.player.y + sink.player.height).toBe(sp.y);
    until(sink, 0, () => sink.deaths > 1);
    dies(sink, 'sinkingPipe');
    // 두 번째 가짜 클리어: "진짜 끝!" 깃발에서 다음 레벨을 누르면 떨어진다
    const fake = respawnAt(12);
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

  it('leaves human slack on the rhythm platforms: up to 9 frames after each landing, while ignoring the beat still fails', () => {
    // 플레이테스트 측정: 박자 발판이 1.0초만 켜져 있을 때는 착지 뒤 0~1프레임 안에 다시 뛰어야 해 사실상 프레임 단위 입력이 필요했다.
    for (let d = 0; d <= 9; d++) {
      const world = respawnAt(11);
      const steps: Step[] = [{ run: 13398 }, { waitUntil: (w) => w.lifeTime % 1.8 < 1 / 60 }, { jump: true }, { wait: d / 60 }, { jump: true }, { wait: d / 60 }, { jump: true }, { wait: d / 60 }, { jump: true }];
      expect(playSolution(world, steps), `${d} frames after each landing`).toBe(steps.length);
      expect(world.deaths).toBe(1);
    }
    const offBeat = respawnAt(11);
    const naive: Step[] = [{ run: 13398 }, { waitUntil: (w) => Math.abs(w.lifeTime % 1.8 - 0.9) < 0.5 / 60 }, { jump: true }, { jump: true }, { jump: true }, { jump: true }];
    playSolution(offBeat, naive);
    expect(offBeat.deaths).toBe(2); // 박자를 무시하고 뛰면 여전히 떨어진다
  });
});
