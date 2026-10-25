import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import type { Rect } from '../../../src/game/physics/AABB';
import { standAt, testLevel } from './fixtures';

// 속임수 함정 4종(docs/traps-spec.md 8·10·11·12번). 함정마다 "처음엔 당한다 → 원인이 표시된다 →
// 알고 나면 실제 입력으로 피할 수 있다"를 함정 하나만 둔 시험용 레벨에서 확인한다.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const jumpRight = { ...right, jumpPressed: true };
function runUntil(world: World, input: typeof idle, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}

describe('#8 dodging platform', () => {
  // 발판(0-300) → 구덩이 → 건너편(560-). 도망가는 발판은 330에서 420으로 미끄러진다. 트리거는 출발 발판 끝 위 공중.
  const platform: Rect = { x: 330, y: 480, width: 60, height: 20 };
  const dodge = { platform, trigger: { x: 260, y: 380, width: 40, height: 100 }, to: { x: 420, y: 480 } };
  const L = testLevel({ solids: [{ x: 0, y: 500, width: 300, height: 120 }, { x: 560, y: 500, width: 1440, height: 120 }], dodgingPlatforms: [dodge] });

  it('slides away from a player jumping at it, who falls in; the original spot is blamed', () => {
    const world = new World(L);
    standAt(world, 274);
    world.update(dt, jumpRight);
    runUntil(world, right, 14); // 원래 발판(330-390) 위까지만 가고 멈춘다
    expect(world.dodgingPlatforms[0].elapsed).not.toBeNull();
    runUntil(world, idle, 200, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toBe(platform);
  });

  it('does not move while the player stands on the ledge inside the trigger zone (air only)', () => {
    const world = new World(L);
    standAt(world, 274); // 트리거(260-300)와 겹치지만 바닥에 서 있다
    for (let i = 0; i < 30; i++) world.update(dt, idle);
    expect(world.dodgingPlatforms[0].elapsed).toBeNull();
  });

  it('triggers when the player enters the zone in the same step they land', () => {
    // 코덱스 리뷰: 이동 뒤의 grounded로 공중 여부를 봐서, 착지하는 바로 그 스텝에 처음 트리거에 들어오면 발동하지 않았다.
    const band = { ...dodge, trigger: { x: 260, y: 490, width: 40, height: 10 } }; // 바닥 바로 위 얇은 띠
    const world = new World(testLevel({ solids: [{ x: 0, y: 500, width: 300, height: 120 }], dodgingPlatforms: [band] }));
    world.player.x = 270; world.player.y = 455; world.player.vy = 780; world.player.grounded = false; // 바닥(487)까지 13px — 이번 스텝에 착지
    world.update(dt, idle);
    expect(world.player.grounded).toBe(true);
    expect(world.dodgingPlatforms[0].elapsed).not.toBeNull();
  });

  it('moves only once, over 0.2s, to its data-defined spot', () => {
    const world = new World(L);
    standAt(world, 274);
    world.update(dt, { ...idle, jumpPressed: true });
    runUntil(world, idle, 11); // 12스텝 = 0.2초
    expect(world.dodgingPlatforms[0].x).toBe(dodge.to.x);
    runUntil(world, idle, 60);
    expect(world.dodgingPlatforms[0].x).toBe(dodge.to.x); // 다시 움직이지 않는다
  });

  it('can be beaten: hop in place to set it off, then jump to where it went', () => {
    const world = new World(L);
    standAt(world, 274);
    world.update(dt, { ...idle, jumpPressed: true }); // 제자리 점프로 트리거만 발동
    runUntil(world, idle, 120, () => world.player.grounded);
    expect(world.player.grounded).toBe(true);
    world.update(dt, jumpRight); // 옮겨 간 발판(420-480)으로 점프
    runUntil(world, right, 120, () => world.player.grounded);
    expect(world.player.x).toBeGreaterThan(dodge.to.x - world.player.width);
    runUntil(world, right, 60, () => world.player.x + world.player.width >= dodge.to.x + platform.width - 10);
    world.update(dt, jumpRight); // 건너편으로
    runUntil(world, right, 120, () => world.player.x > 600);
    expect(world.deaths).toBe(0);
    expect(world.player.x).toBeGreaterThan(600);
  });
});

describe('#10 pop-up spikes', () => {
  const spikes: Rect = { x: 400, y: 476, width: 40, height: 24 };
  const L = testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }], popUpSpikes: [{ spikes, trigger: { x: 340, y: 400, width: 60, height: 100 } }] });

  it('rises in front of a running player too late to stop, and is blamed', () => {
    const world = new World(L);
    standAt(world, 200);
    runUntil(world, right, 120, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toBe(spikes);
  });

  it('stays up once raised, so walking into it later still kills', () => {
    const world = new World(L);
    standAt(world, 320); // 오른쪽 끝(346)이 트리거 안
    world.update(dt, idle);
    expect(world.popUpSpikes[0].raised).toBe(true);
    runUntil(world, idle, 60);
    expect(world.popUpSpikes[0].raised).toBe(true);
    runUntil(world, right, 60, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
  });

  it('can be beaten by jumping just before the trigger zone', () => {
    // 높이 24px 가시를 넘으려면 x 400에 닿을 때 이미 24px 위, x 440을 지날 때까지 그 위에 있어야 한다 —
    // 출발 시 오른쪽 끝이 330~389px일 때 넘으며(고정 스텝 시뮬레이션 실측), 트리거(340) 앞에서 뛰려면 330~339px(10px) 구간이다.
    const world = new World(L);
    standAt(world, 200);
    runUntil(world, right, 120, () => world.player.x + world.player.width >= 330);
    world.update(dt, jumpRight);
    runUntil(world, right, 90, () => world.player.x > 480);
    expect(world.deaths).toBe(0);
    expect(world.player.x).toBeGreaterThan(480);
  });
});

describe('#11 fake checkpoint', () => {
  const real = { zone: { x: 300, y: 360, width: 40, height: 160 }, respawnX: 300, respawnY: 350 };
  const fake: Rect = { x: 500, y: 440, width: 40, height: 60 }; // 위쪽 끝(440)이 점프 최고점의 발 위치(약 419)보다 낮다
  const L = testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }], checkpoints: [real], fakeCheckpoints: [fake] });

  it('kills on touch without saving a respawn point, and is blamed', () => {
    const world = new World(L);
    standAt(world, 250);
    runUntil(world, right, 120, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toBe(fake);
    expect(world.activeCheckpoint).toEqual({ x: real.respawnX, y: real.respawnY }); // 앞의 진짜 체크포인트에서 재시작
    expect(world.player.x).toBe(real.respawnX);
  });

  it('does not save a real checkpoint touched in the same step as a fake one', () => {
    // 코덱스 리뷰: 진짜 체크포인트 저장이 사망 판정보다 먼저라, 둘이 겹친 스텝에 진짜를 저장한 뒤 죽었다.
    const overlapping = testLevel({
      solids: [{ x: 0, y: 500, width: 2000, height: 120 }],
      checkpoints: [{ zone: { x: 500, y: 360, width: 40, height: 160 }, respawnX: 500, respawnY: 350 }],
      fakeCheckpoints: [{ x: 520, y: 440, width: 40, height: 60 }],
    });
    const world = new World(overlapping);
    standAt(world, 515); // 진짜(500-540)와 가짜(520-560) 모두에 겹친다
    world.update(dt, idle);
    expect(world.deaths).toBe(1);
    expect(world.activeCheckpoint).toBeNull();
    expect(world.player.x).toBe(overlapping.spawn.x);
  });

  it('can be jumped over', () => {
    const world = new World(L);
    // 높이 60px 깃발 영역을 넘으려면 출발 시 오른쪽 끝이 454~465px(12px 구간, 고정 스텝 시뮬레이션 실측)여야 한다.
    standAt(world, 400);
    runUntil(world, right, 60, () => world.player.x + world.player.width >= 462);
    world.update(dt, jumpRight);
    runUntil(world, right, 90, () => world.player.x > fake.x + fake.width + 20);
    expect(world.deaths).toBe(0);
  });
});

describe('#12 fleeing goal', () => {
  // 바닥(0-1000) → 구덩이(1000-1100) → 바닥(1100-). 목표(900)는 다가가면 구덩이 건너(1200)로 달아난다.
  const hop = { trigger: { x: 820, y: 400, width: 40, height: 100 }, to: { x: 1200, y: 440, width: 40, height: 60 } };
  const L = testLevel({
    solids: [{ x: 0, y: 500, width: 1000, height: 120 }, { x: 1100, y: 500, width: 900, height: 120 }],
    goal: { x: 900, y: 440, width: 40, height: 60 }, goalHops: [hop],
  });

  it('hops away when approached; chasing straight on falls into the pit, and the hop is blamed', () => {
    const world = new World(L);
    standAt(world, 700);
    runUntil(world, right, 200, () => world.deaths > 0 || world.cleared);
    expect(world.cleared).toBe(false);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toEqual({ x: 820, y: 400, width: 420, height: 100 }); // 트리거 + 도착 위치
  });

  it('finishes the hop in exactly 0.25s (15 steps including the trigger step)', () => {
    // 코덱스 리뷰: 트리거 스텝에는 이동을 시작하지 않아 0.25초 이동이 16스텝에 끝났다.
    const world = new World(L);
    standAt(world, 830);
    world.update(dt, idle); // 1스텝: 트리거
    for (let i = 0; i < 13; i++) world.update(dt, idle); // 14스텝
    expect(world.goal.move).not.toBeNull();
    world.update(dt, idle); // 15스텝 = 0.25초
    expect(world.goal.move).toBeNull();
    expect(world.goal.rect).toEqual(hop.to);
  });

  it('does not count a clear while the goal is moving, and lands exactly on the next spot', () => {
    const world = new World(L);
    standAt(world, 830);
    world.update(dt, idle); // 트리거
    expect(world.goal.move).not.toBeNull();
    world.player.x = world.goal.rect.x; world.player.y = world.goal.rect.y; // 이동 중인 목표와 겹쳐도
    world.update(dt, idle);
    expect(world.cleared).toBe(false);
    runUntil(world, idle, 20);
    expect(world.goal.move).toBeNull();
    expect(world.goal.rect).toEqual(hop.to);
  });

  it('can be beaten by jumping the pit after it hops', () => {
    const world = new World(L);
    standAt(world, 700);
    runUntil(world, right, 200, () => world.player.x + world.player.width >= 980);
    world.update(dt, jumpRight);
    runUntil(world, right, 200, () => world.cleared || world.deaths > 0);
    expect(world.deaths).toBe(0);
    expect(world.cleared).toBe(true);
  });
});
