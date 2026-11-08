import { describe, expect, it } from 'vitest';
import { STONE_SIZE, World, pipeEnemyRect, sinkingPipeRects, stoneRect, type InputState } from '../../../src/game/world/World';
import { ENEMY_HEIGHT } from '../../../src/game/entities/Enemy';
import type { Hill } from '../../../src/game/world/level';
import { standAt, testLevel } from './fixtures';
import { playSolution } from './solution';

// 지형지물 함정 31~33번(docs/traps-spec.md "지형지물 함정").
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const ground = { x: 0, y: 500, width: 2000, height: 120 };
function steps(world: World, n: number, input: InputState = idle): void { for (let i = 0; i < n; i++) world.update(dt, input); }

describe('#31 pipe enemy', () => {
  // 파이프(800, 높이 60) 앞 트리거(600-640)를 지나면 경고 0.3초 → 0.3초 동안 올라옴 → 왼쪽으로 걸어 내려서 640~800을 왕복.
  const pipe = { x: 800, y: 440, width: 60, height: 60 };
  const config = { pipe, trigger: { x: 600, y: 300, width: 40, height: 200 }, minX: 640, maxX: 800 };
  const L = testLevel({ solids: [ground], pipes: [pipe], pipeEnemies: [config] });

  it('warns for 0.3s, then rises out of the pipe top, only the part above the rim counting', () => {
    const world = new World(L);
    standAt(world, 560);
    steps(world, 30);
    expect(world.pipeEnemies[0].phase).toBe('idle');
    standAt(world, 610);
    steps(world, 1);
    expect(world.pipeEnemies[0].phase).toBe('warning');
    expect(world.drainTrapEvents().map((e) => e.kind)).toContain('warning');
    steps(world, 18);
    expect(world.pipeEnemies[0].phase).toBe('emerging');
    steps(world, 9); // 올라오는 0.3초의 절반쯤
    const half = pipeEnemyRect(world.pipeEnemies[0]);
    expect(half?.y).toBeLessThan(pipe.y);
    expect(half && half.y + half.height).toBe(pipe.y); // 입구 아래는 판정이 없다
    expect(half?.height).toBeLessThan(ENEMY_HEIGHT);
    steps(world, 10);
    expect(world.pipeEnemies[0].phase).toBe('walking');
    expect(pipeEnemyRect(world.pipeEnemies[0])?.height).toBe(ENEMY_HEIGHT);
  });

  it('walks off the pipe to the left, lands on the ground and patrols left of the pipe', () => {
    const world = new World(L);
    standAt(world, 610);
    steps(world, 1);
    world.player.x = 100; // 적과 겹치지 않게 비켜 둔다(판정 대상 밖)
    steps(world, 120);
    const pe = world.pipeEnemies[0];
    expect(pe.phase).toBe('patrolling');
    expect(pe.enemy && pe.enemy.y + pe.enemy.height).toBe(ground.y);
    for (let i = 0; i < 240; i++) {
      world.update(dt, idle);
      expect(pe.enemy!.x).toBeGreaterThanOrEqual(config.minX - 1e-6);
      expect(pe.enemy!.x + pe.enemy!.width).toBeLessThanOrEqual(config.maxX + 1e-6);
    }
  });

  it('kills a player standing on the pipe when it comes up; trigger, pipe and patrol are blamed', () => {
    const world = new World(L);
    standAt(world, 610);
    steps(world, 1);
    standAt(world, 815, pipe.y);
    steps(world, 40);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.kind).toBe('pipeEnemy');
    expect(world.deathCause?.rect).toEqual({ x: 600, y: 300, width: 260, height: 200 });
  });

  it('catches a player who runs straight on and jumps onto the pipe', () => {
    const world = new World(L);
    playSolution(world, [{ run: 790 }, { jump: true }, { run: 1000 }]);
    expect(world.deathCause?.kind).toBe('pipeEnemy');
  });

  it('is passed by waiting, jumping over the patrolling enemy and then over the pipe', () => {
    const world = new World(L);
    const pe = world.pipeEnemies[0];
    const gap = () => (pe.enemy ? pe.enemy.x - (world.player.x + world.player.width) : Infinity);
    const n = playSolution(world, [
      { run: 625 },
      { waitUntil: () => pe.phase === 'patrolling' && pe.enemy!.vx < 0 && gap() < 40 },
      { jump: true },
      { runUntil: () => world.player.x + world.player.width >= 780 },
      { jump: true },
      { run: 1000 },
    ]);
    expect(n).toBe(6);
    expect(world.deaths).toBe(0);
  });
});

describe('#32 sinking pipe', () => {
  // 바닥 사이 60px 틈(800-860) 위에 선 가라앉는 파이프. 진짜 파이프처럼 막고, 윗면에 0.3초 서 있으면 가라앉는다.
  const pipe = { x: 800, y: 440, width: 60, height: 60 };
  const L = testLevel({ solids: [{ x: 0, y: 500, width: 800, height: 120 }, { x: 860, y: 500, width: 1140, height: 120 }], sinkingPipes: [{ pipe, delay: 0.3 }] });

  it('is a solid pipe with ground under it until something stands on it', () => {
    const world = new World(L);
    expect(sinkingPipeRects(world.sinkingPipes[0])).toEqual([pipe, { x: 800, y: 500, width: 60, height: 120 }]);
    standAt(world, 600);
    steps(world, 120, right);
    expect(world.player.x + world.player.width).toBe(pipe.x); // 옆에서 막힐 뿐 가라앉지 않는다
    expect(world.sinkingPipes[0].phase).toBe('idle');
  });

  it('sinks 0.3s after the player lands on top and drops them into the pit; the pipe is blamed', () => {
    const world = new World(L);
    standAt(world, 815, pipe.y);
    steps(world, 17);
    expect(world.sinkingPipes[0].phase).toBe('armed');
    steps(world, 2);
    expect(world.sinkingPipes[0].phase).toBe('sinking');
    expect(world.drainTrapEvents().map((e) => e.kind)).toContain('collapse');
    for (let i = 0; i < 240 && world.deaths === 0; i++) world.update(dt, idle);
    expect(world.deaths).toBe(1);
    expect(world.deathCause).toMatchObject({ kind: 'sinkingPipe', rect: { x: 800, y: 440, width: 60, height: 180 } });
  });

  it('is crossed by landing on it and jumping again at once (real input)', () => {
    const world = new World(L);
    expect(playSolution(world, [{ run: 785 }, { jump: true }, { jump: true }, { run: 1100 }])).toBe(4);
    expect(world.deaths).toBe(0);
    expect(world.sinkingPipes[0].phase).not.toBe('idle'); // 올라섰으니 가라앉았다
  });
});

describe('#33 rolling stone', () => {
  // 3단 언덕(400-840, 꼭대기 520-720, 높이 120). 꼭대기 왼쪽 끝의 트리거(520-540)에 오르면 꼭대기 오른쪽 끝(690, 위 350)에
  // 돌이 나타나 0.3초 뒤 왼쪽으로 굴러 단마다 떨어져 내려오고, x 100에서 사라진다.
  const hill: Hill = { x: 400, y: 500, steps: 3, stepWidth: 60, stepHeight: 40, topWidth: 200 };
  const stone = { trigger: { x: 520, y: 300, width: 20, height: 80 }, x: 690, y: 380 - STONE_SIZE, endX: 100 };
  const L = testLevel({ solids: [ground], hills: [hill], rollingStones: [stone] });

  it('appears on the summit, waits 0.3s, then rolls down step by step to the ground', () => {
    const world = new World(L);
    standAt(world, 525, 380);
    steps(world, 1);
    const st = world.rollingStones[0];
    expect(st.phase).toBe('waiting');
    expect(world.drainTrapEvents().map((e) => e.kind)).toContain('boulder');
    world.player.x = 1500; // 돌과 겹치지 않게 비켜 둔다
    steps(world, 17);
    expect(st.phase).toBe('waiting');
    steps(world, 2);
    expect(st.phase).toBe('rolling');
    const heights = new Set<number>();
    for (let i = 0; i < 240 && st.phase === 'rolling'; i++) {
      world.update(dt, idle);
      if (st.vy === 0) heights.add(stoneRect(st).y + STONE_SIZE);
    }
    expect([...heights].sort((a, b) => a - b)).toEqual([380, 420, 460, 500]); // 꼭대기 → 두 단 → 바닥
    expect(st.phase).toBe('gone');
  });

  it('kills a player who climbs straight up the hill; the trigger and the path are blamed', () => {
    const world = new World(L);
    playSolution(world, [{ run: 390 }, { jump: true }, { jump: true }, { run: 1000 }]);
    expect(world.deathCause?.kind).toBe('rollingStone');
    expect(world.deathCause?.rect).toEqual({ x: 100, y: 300, width: 620, height: 200 });
  });

  it('is avoided by jumping over the stone on the summit (real input)', () => {
    const world = new World(L);
    const st = world.rollingStones[0];
    const gap = () => st.x - (world.player.x + world.player.width);
    const n = playSolution(world, [
      { run: 390 }, { jump: true }, { jump: true },
      { waitUntil: () => st.phase === 'rolling' && gap() < 40 },
      { hop: true },
      { run: 1000 },
    ]);
    expect(n).toBe(6);
    expect(world.deaths).toBe(0);
  });
});
