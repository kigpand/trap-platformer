import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import type { SkyDropGroup } from '../../../src/game/world/level';
import { standAt, testLevel } from './fixtures';
import { playSolution, type Step } from './solution';

// #13 하늘에서 쏟아지는 적(docs/traps-spec.md). 함정 하나만 둔 시험용 레벨에서 확인한다.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const ground = { x: 0, y: 500, width: 2000, height: 120 };
const group: SkyDropGroup = {
  trigger: { x: 400, y: 400, width: 40, height: 100 },
  drops: [
    { x: 560, delay: 0, minX: 520, maxX: 640 },
    { x: 900, delay: 0.25, minX: 860, maxX: 980 }, // 순찰 구간 사이에 기다릴 자리(640~860)를 둔다
  ],
};
const L = testLevel({ solids: [ground], skyDrops: [group] });
const steps = (world: World, n: number) => { for (let i = 0; i < n; i++) world.update(dt, idle); };

describe('#13 enemies raining from the sky', () => {
  it('warns 0.4s before each drop, starting each warning at its delay', () => {
    const world = new World(L);
    standAt(world, 410); // 트리거 안
    world.update(dt, idle); // 1스텝: 트리거
    const [a, b] = world.skyDrops[0].enemies;
    expect(a.phase).toBe('warning'); // 지연 0: 트리거 스텝부터 경고
    expect(b.phase).toBe('idle');
    standAt(world, 300); // 떨어지는 곳에서 비켜 서 있는다
    steps(world, 13); // 14스텝
    expect(b.phase).toBe('idle');
    steps(world, 1); // 15스텝 = 0.25초
    expect(b.phase).toBe('warning');
    steps(world, 8); // 23스텝
    expect(a.phase).toBe('warning');
    steps(world, 1); // 24스텝 = 0.4초: 경고 없이 떨어지는 적은 없다
    expect(a.phase).toBe('falling');
    expect(a.enemy?.y).toBeLessThan(0); // 화면 위 바깥에서 생성
    steps(world, 15); // 39스텝 = 0.25 + 0.4초
    expect(b.phase).toBe('falling');
  });

  it('falls under gravity, lands on the ground, then patrols its range', () => {
    const world = new World(L);
    standAt(world, 410);
    world.update(dt, idle);
    standAt(world, 300);
    steps(world, 90);
    const a = world.skyDrops[0].enemies[0];
    expect(a.phase).toBe('patrolling');
    expect(a.enemy!.y + a.enemy!.height).toBe(ground.y);
    const x0 = a.enemy!.x;
    steps(world, 30);
    expect(a.enemy!.x).not.toBe(x0); // 왕복 중
    for (let i = 0; i < 300; i++) {
      world.update(dt, idle);
      expect(a.enemy!.x).toBeGreaterThanOrEqual(group.drops[0].minX);
      expect(a.enemy!.x + a.enemy!.width).toBeLessThanOrEqual(group.drops[0].maxX);
    }
  });

  it('disappears when it falls into a pit', () => {
    const world = new World(testLevel({ solids: [{ x: 0, y: 500, width: 500, height: 120 }, { x: 700, y: 500, width: 1300, height: 120 }], skyDrops: [{ trigger: group.trigger, drops: [{ x: 600, delay: 0, minX: 580, maxX: 640 }] }] }));
    standAt(world, 410);
    world.update(dt, idle);
    standAt(world, 300);
    steps(world, 120);
    expect(world.skyDrops[0].enemies[0].phase).toBe('gone');
    expect(world.skyDrops[0].enemies[0].enemy).toBeNull();
  });

  it('kills on contact while falling, blaming the trigger and drop columns', () => {
    const world = new World(L);
    standAt(world, 410);
    world.update(dt, idle);
    standAt(world, 560); // 첫 적이 떨어지는 바로 아래
    for (let i = 0; i < 90 && world.deaths === 0; i++) world.update(dt, idle);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toEqual({ x: 400, y: 400, width: 900 + 28 - 400, height: 100 });
  });

  it('can be beaten: step into the trigger and back, wait for them to land, then jump each one head-on', () => {
    const world = new World(L);
    standAt(world, 300);
    const headOn = (i: number): Step[] => [
      { waitUntil: (w) => { const e = w.skyDrops[0].enemies[i].enemy; return !!e && w.skyDrops[0].enemies[i].phase === 'patrolling' && e.vx < 0 && e.x >= group.drops[i].maxX - 40; } },
      { runUntil: (w) => { const e = w.skyDrops[0].enemies[i].enemy!; return w.player.grounded && e.x - (w.player.x + w.player.width) <= 45; } },
      { jump: true },
    ];
    const solution: Step[] = [
      { run: group.trigger.x + 4 }, { left: 20 }, // 트리거 끝만 밟고 물러선다(떨어지는 위치 520~ 밖)
      { waitUntil: (w) => w.skyDrops[0].enemies.every((se) => se.phase === 'patrolling') },
      { run: 500 }, ...headOn(0), // 첫 번째 적(520~640) 앞에서 마주 올 때를 기다렸다 넘는다
      { run: 760 }, ...headOn(1), // 두 순찰 구간 사이(640~860)에서 기다린다
      { run: 1040 },
    ];
    expect(playSolution(world, solution)).toBe(solution.length);
    expect(world.deaths).toBe(0);
  });

  it('gives no gravity to regular or ambush enemies (rule change applies to #13 only)', () => {
    // 적 중력은 13번의 등장 단계에만 허용된다(traps-spec "적 충돌 규칙" 예외). 구덩이 위에서도 떠 있어야 한다.
    const world = new World(testLevel({
      solids: [{ x: 0, y: 500, width: 200, height: 120 }],
      enemies: [{ minX: 400, maxX: 600, y: 300 }],
      ambushes: [{ trigger: { x: 100, y: 400, width: 40, height: 100 }, minX: 400, maxX: 600, y: 200 }],
    }));
    standAt(world, 110);
    steps(world, 120);
    expect(world.enemies[0].y).toBe(300);
    expect(world.ambushes[0].enemy?.y).toBe(200);
  });
});
