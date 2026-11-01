import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { LEVEL_4, LEVELS } from '../../../src/game/world/level';
import { playSolution, type Step } from './solution';
import { jumpSlack } from './tolerance';

// 레벨 4(지옥, 18,600px): 함정 30종을 셋씩 겹친 구간 아홉 개와 마지막 가짜 연속 구간(docs/game-design.md "난이도 곡선").
// 한 함정을 피하는 방법이 다른 함정을 부르도록 묶고, 체크포인트는 두 구간마다 하나 둔다. 해법의 점프마다 6프레임 이상 여유를 둔다.
const dt = 1 / 60;
const mirror = (w: World) => w.mirrorEnemies[0];
const ambusher = (w: World) => w.ambushes[0].enemy;
const arrowNear = (i: number, px: number) => (w: World) => { const a = w.arrowTraps[0].arrows[i]; return a.phase === 'flying' && a.x <= w.player.x + w.player.width + px; };
// 1. 그림자가 쫓아오는 사라지는 땅 위로 쏟아지는 적: 멈추면 그림자, 그대로 달리면 적 — 달리면서 적을 넘는다.
const SHADOW_DROPS: Step[] = [{ run: 1676 }, { jump: true }, { run: 1965 }, { jump: true }];
// 2. 얼음 위 좌우 반전: 반전되면 ←로 미끄러짐을 이어 가고, 풀리면 얼음 끝 구덩이를 넘은 뒤 솟는 가시를 넘는다.
const ICE_REVERSE_SPIKES: Step[] = [
  { run: 2815 }, { jump: true }, { runUntil: (w) => w.reverse !== null }, { leftUntil: (w) => w.reverse === null },
  { run: 3486 }, { jump: true }, { run: 3677 }, { jump: true },
];
// 3. 박자 발판 높이로 날아오는 낮은 화살: 첫 화살은 박자대로 뛰는 사이 발밑으로 지나가고, 둘째는 내리자마자 제자리에서 넘는다.
const RHYTHM_ARROWS: Step[] = [
  { run: 4998 }, { waitUntil: (w) => w.lifeTime % 1.8 < 1 / 60 }, { jump: true }, { jump: true }, { jump: true }, { jump: true },
  { run: 5560 }, { waitUntil: arrowNear(1, 80) }, { hop: true }, { waitUntil: (w) => w.arrowTraps[0].arrows[1].phase === 'gone' },
];
// 4. 내려오는 천장 통로 안의 따라 뛰는 적: 적이 먼 끝에서 돌아설 때 들어가, 마주 오면 제자리에서 뛰어 머리 위로 넘긴다.
// 통로를 나오면 떨어지는 천장 — 한 발 들어가 떨어뜨리고 물러섰다가 넘는다.
const CEILING_MIRROR: Step[] = [
  { run: 6540 }, { waitUntil: (w) => mirror(w).enemy.vx < 0 && mirror(w).enemy.x >= 7300 - 28 - 4 },
  { runUntil: (w) => mirror(w).enemy.x - (w.player.x + w.player.width) <= 50 }, { hop: true },
  { waitUntil: (w) => !mirror(w).airborne && mirror(w).enemy.x + mirror(w).enemy.width < w.player.x - 10 },
  { run: 7565 }, { right: 4 }, { left: 20 }, { wait: 1 }, { run: 7560 }, { jump: true },
];
// 5. "여기서 점프!" 표지판 = 무거운 신발 구역 = 착지 예측 가시 구역: 구역 앞에서 보통 점프로 넘는다.
const HEAVY_SPIKES: Step[] = [{ run: 9135 }, { jump: true }];
// 6. 돌덩이에 쫓기며 가짜 벽을 그대로 지나, 세 번째 착지 발판 위 장애물 셋을 두 번만 착지해 넘는다(둘째 점프로 B를 넘어 C 위에 선다).
const BOULDER_COUNTING: Step[] = [{ run: 11600 }, { jump: true }, { run: 11765 }, { jump: true }];
// 7. 숨겨진 블록 틈을 뛰어넘고, 낙하 발판에 내리자마자 다시 뛰고, 기습 적은 먼 끝에서 돌아올 때 마주 넘는다.
const HIDDEN_FALLING_AMBUSH: Step[] = [
  { run: 12860 }, { jump: true }, { run: 13050 }, { jump: true }, { jump: true },
  { run: 13470 }, { waitUntil: (w) => { const e = ambusher(w); return !!e && e.vx < 0 && e.x >= 13760 - 28 - 40; } },
  { runUntil: (w) => { const e = ambusher(w); return !!e && e.x - (w.player.x + w.player.width) <= 45; } }, { jump: true },
];
// 8. 도망가는 발판이 투명 블록 아래로 비켜선다: 가장자리보다 일찍 뛰어 비켜선 발판에 내리고, 스프링 앞 좁은 땅에 내려 스프링을 넘는다.
const DODGE_INVISIBLE_SPRING: Step[] = [{ run: 14655 }, { jump: true }, { run: 14830 }, { jump: true }, { jump: true }];
const BACK_PIT: Step[] = [{ run: 15900 }, { jump: true }]; // 날려버리는 점프가 떨어뜨리는 뒤쪽 구덩이
// 9. 조건부 함정(머뭇거림) 다음 날려버리는 점프(가장자리)를 피해 일찍 뛰고, 가짜 안전지대를 넘는다.
const CONDITIONAL_FLING_HAZARD: Step[] = [{ run: 16410 }, { jump: true }, { run: 16655 }, { jump: true }];
// 끝: "진짜 끝!" 표지판 → 가짜 체크포인트를 넘고 → 가짜 클리어 깃발을 멈추지 않고 지나 → 세 번 도망가는 목표를 쫓는다.
const FINALE: Step[] = [{ run: 16955 }, { jump: true }, { run: 17780 }, { jump: true }, { run: 18110 }, { jump: true }, { run: 18560 }];

const FROM_SPAWN: Step[] = [...SHADOW_DROPS, ...ICE_REVERSE_SPIKES];
const FROM_CP1: Step[] = [...RHYTHM_ARROWS, ...CEILING_MIRROR];
const FROM_CP2: Step[] = [...HEAVY_SPIKES, ...BOULDER_COUNTING];
const FROM_CP3: Step[] = [...HIDDEN_FALLING_AMBUSH, ...DODGE_INVISIBLE_SPRING, ...BACK_PIT];
const FROM_CP4: Step[] = [...CONDITIONAL_FLING_HAZARD, ...FINALE];
const FULL: Step[] = [...FROM_SPAWN, ...FROM_CP1, ...FROM_CP2, ...FROM_CP3, ...FROM_CP4];

function respawnAt(index: number): World {
  const cp = LEVEL_4.checkpoints[index];
  const world = new World(LEVEL_4);
  world.activeCheckpoint = { x: cp.respawnX, y: cp.respawnY };
  world.reset(true);
  return world;
}
const step = (w: World, horizontal: -1 | 0 | 1, jumpPressed = false) => w.update(dt, { horizontal, jumpPressed, restartPressed: false });
// 해법 일부를 따라간 뒤 horizontal을 누른 채(jump면 그 자리에서 한 번 뛰고) 죽을 때까지 두고, 사망 원인을 돌려준다.
function naive(start: World, steps: Step[], horizontal: -1 | 0 | 1, jump = false): string | null {
  const deaths = start.deaths;
  playSolution(start, steps);
  if (start.deaths === deaths) {
    if (jump) step(start, horizontal, true);
    for (let i = 0; i < 1500 && start.deaths === deaths; i++) step(start, horizontal);
  }
  expect(start.deaths).toBe(deaths + 1);
  return start.snapshot().deathKind;
}

describe('LEVEL_4 (hell)', () => {
  it('is the last level, the longest, and uses every trap kind (1-30)', () => {
    expect(LEVELS[LEVELS.length - 1]).toBe(LEVEL_4);
    expect(LEVEL_4.width).toBe(18600);
    expect(LEVEL_4.width).toBeGreaterThan(Math.max(...LEVELS.slice(0, -1).map((l) => l.width)));
    const kinds = [LEVEL_4.hiddenBlocks, LEVEL_4.fallingPlatforms, LEVEL_4.ambushes, LEVEL_4.hazards, LEVEL_4.conditionalTraps,
      LEVEL_4.vanishingGrounds, LEVEL_4.invisibleBlocks, LEVEL_4.dodgingPlatforms, LEVEL_4.fallingCeilings, LEVEL_4.popUpSpikes,
      LEVEL_4.fakeCheckpoints, LEVEL_4.goalHops, LEVEL_4.skyDrops, LEVEL_4.fakeGoals, LEVEL_4.flingZones, LEVEL_4.reverseZones,
      LEVEL_4.springFloors, LEVEL_4.signs, LEVEL_4.boulders, LEVEL_4.fakeWalls, LEVEL_4.baitGems, LEVEL_4.shadows,
      LEVEL_4.landingSpikeZones, LEVEL_4.heavyZones, LEVEL_4.descendingCeilings, LEVEL_4.arrowTraps, LEVEL_4.rhythmPlatforms,
      LEVEL_4.iceFloors, LEVEL_4.mirrorEnemies, LEVEL_4.countingPlatforms];
    expect(kinds).toHaveLength(30);
    expect(kinds.every((list) => list.length > 0)).toBe(true);
    expect(LEVEL_4.goalHops).toHaveLength(3); // 진짜 목표는 세 번 도망간다
  });

  it('keeps one checkpoint per two trap sections', () => {
    // 스폰 → 1·2구간, 체크포인트 1 → 3·4, 2 → 5·6, 3 → 7·8, 4 → 9·끝 구간.
    expect(LEVEL_4.checkpoints.map((cp) => cp.respawnX)).toEqual([4600, 8450, 12450, 16200]);
  });

  it('can be finished from spawn with the solution inputs and no deaths', () => {
    const world = new World(LEVEL_4);
    expect(playSolution(world, FULL)).toBe(FULL.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(0);
    expect(world.goal.rect).toEqual(LEVEL_4.goalHops[LEVEL_4.goalHops.length - 1].to);
  });

  it.each([
    ['checkpoint 1 (rhythm platforms and arrows)', 0, [...FROM_CP1, ...FROM_CP2, ...FROM_CP3, ...FROM_CP4]],
    ['checkpoint 2 (heavy shoes and landing spikes)', 1, [...FROM_CP2, ...FROM_CP3, ...FROM_CP4]],
    ['checkpoint 3 (hidden block, falling platform, ambush)', 2, [...FROM_CP3, ...FROM_CP4]],
    ['checkpoint 4 (conditional trap, fling jump, fake safe zone)', 3, FROM_CP4],
  ] as const)('can be finished from %s with no further deaths', (_, index, steps) => {
    const world = respawnAt(index);
    expect(playSolution(world, steps)).toBe(steps.length);
    expect(world.cleared).toBe(true);
    expect(world.deaths).toBe(1);
  });

  it('leaves at least 6 frames of human slack on every solution jump', () => {
    // docs/game-design.md "사람 손 여유 하한": 점프마다 몇 프레임 일찍·늦게 눌러도 뒤의 세 명령까지 사망 없이 가는지 잰다.
    // 체크포인트마다 따로 재 시간을 줄인다(재시작 직후 사망 수 1을 0으로 돌려 놓고 잰다).
    const fresh = (index: number) => () => { const w = respawnAt(index); w.deaths = 0; return w; };
    const segments: [string, () => World, Step[]][] = [
      ['spawn', () => new World(LEVEL_4), FROM_SPAWN], ['checkpoint 1', fresh(0), FROM_CP1], ['checkpoint 2', fresh(1), FROM_CP2],
      ['checkpoint 3', fresh(2), FROM_CP3], ['checkpoint 4', fresh(3), FROM_CP4],
    ];
    for (const [name, make, steps] of segments) {
      const slack = jumpSlack(make, steps);
      expect(slack.length, name).toBe(steps.filter((s) => 'jump' in s || 'hop' in s).length);
      for (const s of slack) expect(s.total, `${name} step ${s.index}: ${s.early} early + ${s.late} late`).toBeGreaterThanOrEqual(6);
    }
  });

  it('catches the naive play in each stacked section', () => {
    // 1. 그대로 달리면 쏟아지는 적, 멈추면 그림자
    expect(naive(new World(LEVEL_4), [], 1)).toBe('skyDrop');
    expect(naive(new World(LEVEL_4), [{ run: 1500 }], 0)).toBe('shadow');
    // 2. 반전된 채 →를 계속 누르면 얼음 위에서 멈췄다가 거꾸로 미끄러져 뒤쪽 구덩이로
    expect(naive(new World(LEVEL_4), [...SHADOW_DROPS, { run: 2815 }, { jump: true }], 1)).toBe('reverseZone');
    // 3. 박자보다 늦게 올라타 머뭇거리면 발판이 사라지고, 내려서 그대로 달리면 둘째 화살
    expect(naive(respawnAt(0), [{ run: 4998 }, { waitUntil: (w) => w.lifeTime % 1.8 > 0.15 && w.lifeTime % 1.8 < 0.2 }, { jump: true }], 0)).toBe('rhythmPlatform');
    expect(naive(respawnAt(0), RHYTHM_ARROWS.slice(0, 6), 1)).toBe('arrow');
    // 4. 따라 뛰는 적을 가까이서 넘으려 하면 같이 뛰고, 통로에서 기다리면 천장, 통로를 나와 그대로 달리면 떨어지는 천장
    const toCorridor = [...RHYTHM_ARROWS, ...CEILING_MIRROR.slice(0, 2)];
    expect(naive(respawnAt(0), [...toCorridor, { runUntil: (w) => mirror(w).enemy.x - (w.player.x + w.player.width) <= 20 }], 1, true)).toBe('mirrorEnemy');
    expect(naive(respawnAt(0), [...toCorridor, { run: 6700 }], 0)).toBe('descendingCeiling');
    expect(naive(respawnAt(0), [...RHYTHM_ARROWS, ...CEILING_MIRROR.slice(0, 5)], 1)).toBe('fallingCeiling');
    // 5. 표지판 말대로 구덩이 가장자리(구역 안)에서 뛰면 착지 지점에 가시
    expect(naive(respawnAt(1), [{ run: 9195 }], 1, true)).toBe('landingSpikes');
    // 6. 가짜 벽 앞에서 멈추면 돌덩이, 장애물마다 바로 앞에서 뛰면 세 번째 착지에 발판이 무너진다
    expect(naive(respawnAt(1), [...HEAVY_SPIKES, { run: 11000 }], 0)).toBe('boulder');
    expect(naive(respawnAt(1), [...HEAVY_SPIKES, { run: 11620 }, { jump: true }, { run: 11790 }, { jump: true }, { run: 11850 }], 1, true)).toBe('countingPlatform');
    // 7. 틈을 걸어서 지나면 숨겨진 블록, 낙하 발판에서 머뭇거리면 발판째, 착지해 그대로 달리면 기습 적
    expect(naive(respawnAt(2), [], 1)).toBe('hiddenBlock');
    expect(naive(respawnAt(2), HIDDEN_FALLING_AMBUSH.slice(0, 4), 0)).toBe('fallingPlatform');
    expect(naive(respawnAt(2), HIDDEN_FALLING_AMBUSH.slice(0, 5), 1)).toBe('ambush');
    // 8. 가장자리에서 뛰면 투명 블록에 머리를 찧고, 더 일찍 뛰면 발판이 비켜선다
    const toDodge = HIDDEN_FALLING_AMBUSH;
    expect(naive(respawnAt(2), [...toDodge, { run: 14700 }], 1, true)).toBe('invisibleBlock');
    expect(naive(respawnAt(2), [...toDodge, { run: 14600 }], 1, true)).toBe('dodgingPlatform');
    // 9. 가장자리 앞에서 머뭇거리면 조건부 함정, 가장자리에서 뛰면 뒤쪽 구덩이로 날아가고, 건너서 그대로 달리면 가짜 안전지대
    expect(naive(respawnAt(3), [{ run: 16400 }], 0)).toBe('conditional');
    expect(naive(respawnAt(3), [{ run: 16445 }], 1, true)).toBe('flingJump');
    expect(naive(respawnAt(3), CONDITIONAL_FLING_HAZARD.slice(0, 2), 1)).toBe('hazard');
    // 끝: 가짜 체크포인트에 닿으면 터지고, 가짜 클리어에서 다음 레벨을 누르면 떨어지고, 달아난 목표를 쫓다 구덩이에 빠진다
    expect(naive(respawnAt(3), CONDITIONAL_FLING_HAZARD, 1)).toBe('fakeCheckpoint');
    const fake = respawnAt(3);
    playSolution(fake, [...CONDITIONAL_FLING_HAZARD, ...FINALE.slice(0, 2), { run: LEVEL_4.fakeGoals[0].flag.x + 10 }]);
    expect(fake.snapshot().cleared).toBe(true);
    expect(fake.collapseFakeFloor()).toBe(true);
    expect(naive(fake, [], 0)).toBe('fakeClear');
    expect(naive(respawnAt(3), [...CONDITIONAL_FLING_HAZARD, ...FINALE.slice(0, 2)], 1)).toBe('fleeingGoal');
  });

  it('bounces back off the spring when jumping late from the dodged platform', () => {
    const world = respawnAt(2);
    playSolution(world, [...HIDDEN_FALLING_AMBUSH, ...DODGE_INVISIBLE_SPRING.slice(0, 2), { run: 14860 }, { jump: true }]);
    expect(world.springFloors[0].bounced).toBe(true);
    expect(world.snapshot().deaths).toBe(1);
  });
});
