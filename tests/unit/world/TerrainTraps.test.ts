import { describe, expect, it } from 'vitest';
import { World, vanishingTile } from '../../../src/game/world/World';
import type { Level } from '../../../src/game/world/level';
import type { Rect } from '../../../src/game/physics/AABB';

// 지형 함정 3종(docs/traps-spec.md 6·7·9번)을 함정 하나만 둔 작은 시험용 레벨에서 검증한다.
// 실제 레벨 배치와 해법 입력 완주는 레벨 연장(roadmap 함정 확장 5번)에서 검증한다.
const dt = 1 / 60;
const idle = { horizontal: 0 as const, jumpPressed: false, restartPressed: false };
const right = { horizontal: 1 as const, jumpPressed: false, restartPressed: false };
const left = { horizontal: -1 as const, jumpPressed: false, restartPressed: false };

function level(parts: Partial<Level>): Level {
  return {
    width: 2000, height: 620, spawn: { x: 65, y: 350 }, solids: [], goal: { x: 1990, y: 0, width: 10, height: 10 },
    hazards: [], fallingPlatforms: [], hiddenBlocks: [], enemies: [], ambushes: [], conditionalTraps: [], checkpoints: [],
    vanishingGrounds: [], invisibleBlocks: [], fallingCeilings: [], ...parts,
  };
}
function standAt(world: World, x: number, groundY = 500): void {
  world.player.x = x; world.player.y = groundY - world.player.height; world.player.vy = 0; world.player.grounded = true;
}
function runUntil(world: World, input: typeof idle, steps: number, stop: () => boolean = () => false): void {
  for (let i = 0; i < steps && !stop(); i++) world.update(dt, input);
}

describe('#6 vanishing ground (chain collapse)', () => {
  // 바닥(0-300) → 사라지는 땅(300-700, 40px 칸 10개, 아래는 구덩이) → 바닥(700-2000)
  const vanishing: Rect = { x: 300, y: 500, width: 400, height: 120 };
  const L = level({ solids: [{ x: 0, y: 500, width: 300, height: 120 }, { x: 700, y: 500, width: 1300, height: 120 }], vanishingGrounds: [vanishing] });

  it('starts collapsing from the section start when stepped on, removing the first tile ~0.267s later', () => {
    const world = new World(L);
    standAt(world, 400); // 구간 중간(칸 2)에 서 있어도 전선은 시작점에서 출발한다
    world.update(dt, idle);
    const vg = world.vanishingGrounds[0];
    expect(vg.elapsed).not.toBeNull();
    runUntil(world, idle, 14); // 트리거 스텝 포함 15스텝 = 0.25초
    expect(vg.tilesGone).toBe(0);
    world.update(dt, idle); // 16스텝 = 0.2667초
    expect(vg.tilesGone).toBe(1);
    expect(world.dynamicSolids()).not.toContainEqual(vanishingTile(vanishing, 0));
  });

  it('lets a player who keeps running get across', () => {
    const world = new World(L);
    standAt(world, 240);
    runUntil(world, right, 200, () => world.player.x > 720); // 240→720px는 210px/s로 약 2.3초
    expect(world.deaths).toBe(0);
    expect(world.player.x).toBeGreaterThan(720);
  });

  it('removes a shorter last tile only after a full tile\'s time, like the others', () => {
    // 100px 구간 = 40px·40px·20px 칸. 마지막(짧은) 칸도 명세 공식대로 3 × 40 / 150 = 0.8초(48스텝)에 사라진다.
    const shortSection: Rect = { x: 300, y: 500, width: 100, height: 120 };
    const world = new World(level({ solids: [{ x: 0, y: 500, width: 300, height: 120 }, { x: 400, y: 500, width: 1600, height: 120 }], vanishingGrounds: [shortSection] }));
    standAt(world, 310);
    world.update(dt, idle); // 1스텝: 트리거
    standAt(world, 600); // 붕괴는 계속 진행되지만 플레이어는 안전한 바닥으로 옮겨 사망으로 초기화되지 않게 한다
    runUntil(world, idle, 46); // 47스텝 ≈ 0.783초
    expect(world.vanishingGrounds[0].tilesGone).toBe(2);
    world.update(dt, idle); // 48스텝 = 0.8초
    expect(world.vanishingGrounds[0].tilesGone).toBe(3);
  });

  it('drops a player who stops on it, and blames the section', () => {
    const world = new World(L);
    standAt(world, 320);
    runUntil(world, idle, 240, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toBe(vanishing);
  });
});

describe('#7 invisible block', () => {
  const block: Rect = { x: 300, y: 430, width: 60, height: 20 }; // 아랫면 450: 플레이어 키(32)보다 높고 점프 높이(81) 안쪽
  const flat = level({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }], invisibleBlocks: [block] });

  it('does not appear when walking underneath', () => {
    const world = new World(flat);
    standAt(world, 200);
    runUntil(world, right, 60);
    expect(world.player.x).toBeGreaterThan(block.x + block.width);
    expect(world.invisibleBlocks[0].visible).toBe(false);
  });

  it('appears when hit from below while rising, and stops the jump', () => {
    const world = new World(flat);
    standAt(world, block.x + 10);
    world.update(dt, { ...idle, jumpPressed: true });
    runUntil(world, idle, 30, () => world.invisibleBlocks[0].visible);
    expect(world.invisibleBlocks[0].visible).toBe(true);
    world.update(dt, idle);
    expect(world.player.y).toBeGreaterThanOrEqual(block.y + block.height); // 머리가 아랫면에서 막힌다
    expect(world.player.vy).toBeGreaterThanOrEqual(0);
  });

  it('stays hidden and lets the player pass when touched from above or the side', () => {
    const world = new World(flat);
    world.player.x = block.x + 10; world.player.y = block.y - 40; world.player.vy = 200; // 위에서 떨어지며 통과
    runUntil(world, idle, 30);
    expect(world.invisibleBlocks[0].visible).toBe(false);
    expect(world.player.grounded).toBe(true); // 블록을 지나 바닥에 착지
    standAt(world, block.x - 40);
    world.update(dt, { ...right, jumpPressed: true }); // 옆에서 대각선으로: 머리가 이미 아랫면보다 높은 상태로 블록 영역에 들어간다
    runUntil(world, right, 40);
    expect(world.invisibleBlocks[0].visible).toBe(false); // 아래에서 찧은 게 아니므로 나타나지 않는다
    expect(world.player.x).toBeGreaterThan(block.x + block.width);
  });

  it('does not appear when the player reaches its height from the side in the same step it enters horizontally', () => {
    // 코덱스 리뷰: 이동 후 x만 보고 겹침을 판정해서, 블록 옆에서 대각선으로 올라오며 머리가 아랫면 높이를 막 지나는
    // 스텝에 수평으로 막 겹치기 시작하면(머리가 아랫면 높이를 지날 때는 아직 블록 옆이었는데) 아랫면을 찧은 것으로 봤다.
    const world = new World(flat);
    const bottom = block.y + block.height;
    world.player.x = block.x - world.player.width - 1; // 블록 왼쪽 옆, 겹치지 않음
    world.player.y = bottom + 1; // 머리가 아랫면보다 1px 아래
    world.player.vx = 210; world.player.vy = -480; world.player.grounded = false;
    world.update(dt, right); // 이번 스텝: 머리는 약 0.1 지점에서 아랫면 높이를 지나고, 수평 겹침은 그보다 늦게 시작된다
    expect(world.invisibleBlocks[0].visible).toBe(false);
  });

  it('blames the block when it knocks the player into a pit', () => {
    // 바닥(0-330) → 구덩이 → 바닥(470-): 가장자리에서 늦게 뛰면 블록에 머리를 찧고 구덩이로 떨어진다.
    const pitBlock: Rect = { x: 330, y: 430, width: 80, height: 20 };
    const world = new World(level({ solids: [{ x: 0, y: 500, width: 330, height: 120 }, { x: 470, y: 500, width: 1530, height: 120 }], invisibleBlocks: [pitBlock] }));
    standAt(world, 300);
    world.update(dt, { ...right, jumpPressed: true });
    runUntil(world, right, 240, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toBe(pitBlock);
  });
});

describe('#9 falling ceiling', () => {
  // 공중 블록(600-640, 높이 40)과 그 앞·아래 트리거(560-640). 떨어지면 바닥(500) 위 높이 40px 장애물이 된다.
  const ceiling = { block: { x: 600, y: 380, width: 40, height: 40 }, trigger: { x: 560, y: 380, width: 80, height: 120 } };
  const L = level({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }], fallingCeilings: [ceiling] });

  it('crushes a player who walks straight under it, and blames the block', () => {
    const world = new World(L);
    standAt(world, 480);
    runUntil(world, right, 120, () => world.deaths > 0);
    expect(world.deaths).toBe(1);
    expect(world.deathCause?.rect).toBe(ceiling.block);
  });

  it('can be dropped first by stepping into the trigger and back, then jumped over once landed', () => {
    const world = new World(L);
    standAt(world, 534); // 오른쪽 끝이 트리거 바로 앞(560)
    world.update(dt, right); world.update(dt, right); // 트리거에 살짝 들어간다
    runUntil(world, left, 20); // 물러선다
    runUntil(world, idle, 60, () => world.fallingCeilings[0].phase === 'landed');
    const c = world.fallingCeilings[0];
    expect(c.phase).toBe('landed');
    expect(c.y + ceiling.block.height).toBe(500); // 바닥 위에 섰다
    expect(world.deaths).toBe(0);
    // 착지한 블록은 벽처럼 막는다
    standAt(world, 540);
    runUntil(world, right, 30);
    expect(world.player.x + world.player.width).toBeLessThanOrEqual(ceiling.block.x + 0.5);
    // 높이 40px라 점프로 넘을 수 있다
    world.update(dt, { ...right, jumpPressed: true });
    runUntil(world, right, 60);
    expect(world.player.x).toBeGreaterThan(ceiling.block.x + ceiling.block.width);
    expect(world.deaths).toBe(0);
  });

  it('starts falling exactly 0.1s (6 steps) after the trigger, not a frame later', () => {
    // 코덱스 리뷰: 0.1 − 6 × (1/60)이 부동소수 오차로 0보다 조금 크게 남아 7스텝째에 떨어졌다.
    const world = new World(L);
    standAt(world, 400); // 트리거 밖
    world.player.x = 570; // 트리거 안으로(플레이어가 깔리지 않게 아래 검사는 위치만 본다)
    world.update(dt, idle); // 1스텝: 트리거
    expect(world.fallingCeilings[0].phase).toBe('armed');
    standAt(world, 400); // 블록 밑에서 벗어나 깔림 사망으로 상태가 초기화되지 않게 한다
    runUntil(world, idle, 4); // 5스텝
    expect(world.fallingCeilings[0].phase).toBe('armed');
    expect(world.fallingCeilings[0].y).toBe(ceiling.block.y);
    world.update(dt, idle); // 6스텝 = 0.1초
    expect(world.fallingCeilings[0].phase).toBe('falling');
    expect(world.fallingCeilings[0].y).toBeGreaterThan(ceiling.block.y);
  });

  it('lands on a 20px platform without tunneling even at max fall speed', () => {
    // 최대 낙하 속도(900px/s)에서 한 스텝 이동량은 15px로, 명세의 가장 얇은 발판(20px)보다 작다.
    const platform: Rect = { x: 500, y: 400, width: 100, height: 20 };
    const high = { block: { x: 520, y: -100, width: 40, height: 40 }, trigger: { x: 0, y: 0, width: 200, height: 620 } };
    const world = new World(level({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }, platform], fallingCeilings: [high] }));
    standAt(world, 100);
    let maxVy = 0;
    runUntil(world, idle, 120, () => {
      maxVy = Math.max(maxVy, world.fallingCeilings[0].vy);
      return world.fallingCeilings[0].phase === 'landed' || world.fallingCeilings[0].phase === 'gone';
    });
    expect(maxVy).toBe(900); // 최대 속도에 도달한 뒤 착지했다
    expect(world.fallingCeilings[0].phase).toBe('landed');
    expect(world.fallingCeilings[0].y + high.block.height).toBe(platform.y);
  });
});
