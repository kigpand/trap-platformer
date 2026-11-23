import { describe, expect, it } from 'vitest';
import { World, type InputState } from '../../../src/game/world/World';
import { dt, idle, runUntil, standAt, testLevel } from './fixtures';

// 점프 입력 버퍼(docs/physics-spec.md "점프 입력 버퍼"): 바닥에 없을 때 누른 점프는 그 뒤 6스텝 안에 바닥에 서면 그 스텝에 뛴다.
// 명세 값을 그대로 적는다 — 상수를 가져와 쓰면 상수를 바꿔도 테스트가 따라 바뀌어 잡지 못한다.
const BUFFER = 6;
const jump: InputState = { ...idle, jumpPressed: true };
const floor = { x: 0, y: 500, width: 2000, height: 120 };

// 바닥에서 뛰어 내려오는 중에 점프를 누른다. 착지한 다음 스텝(바닥에 서서 시작하는 첫 스텝 — 그때 직접 눌렀다면 뛰었을 스텝)보다
// lead 스텝 먼저 누른다(lead 1이면 착지하는 바로 그 스텝). 다시 뛰었으면 누른 뒤 몇 번째 스텝에 바닥을 떠났는지, 아니면 null.
function pressBeforeLanding(lead: number): number | null {
  const world = new World(testLevel({ solids: [floor] }));
  standAt(world, 300);
  world.update(dt, jump);
  // 먼저 착지까지 몇 스텝인지 같은 상황을 따로 돌려 센다.
  const probe = new World(testLevel({ solids: [floor] }));
  standAt(probe, 300);
  probe.update(dt, jump);
  let toLand = 0;
  while (!probe.player.grounded) { probe.update(dt, idle); toLand++; }
  runUntil(world, idle, toLand - lead);
  world.update(dt, jump);
  for (let i = 0; i < lead + BUFFER + 2; i++) {
    const wasGrounded = world.player.grounded;
    world.update(dt, idle);
    if (wasGrounded && !world.player.grounded) return i;
  }
  return null;
}

describe('점프 입력 버퍼', () => {
  it('뛸 수 있는 스텝보다 6스텝 안에서 먼저 누른 점프는 착지한 다음 스텝에 실행된다', () => {
    for (let lead = 1; lead <= BUFFER; lead++) expect(pressBeforeLanding(lead), `lead ${lead}`).toBe(lead - 1);
  });

  it('그보다 일찍 누른 점프는 버려진다', () => {
    expect(pressBeforeLanding(BUFFER + 1)).toBeNull();
    expect(pressBeforeLanding(BUFFER + 10)).toBeNull();
  });

  it('바닥에 서 있을 때 누르면 그 스텝에 바로 뛰고, 착지 뒤에 다시 뛰지 않는다', () => {
    const world = new World(testLevel({ solids: [floor] }));
    standAt(world, 300);
    world.update(dt, jump);
    expect(world.player.grounded).toBe(false);
    expect(world.drainEvents()).toEqual(['jump']);
    runUntil(world, idle, 120);
    expect(world.player.grounded).toBe(true);
    expect(world.drainEvents()).toEqual([]); // 한 번 누른 점프는 한 번만 실행된다
  });

  it('죽거나 재시작하면 버퍼를 비운다', () => {
    const world = new World(testLevel({ solids: [floor] }));
    world.player.y = 100; world.player.grounded = false; // 공중에서 누름
    world.update(dt, jump);
    world.reset(true); // 사망 → 스폰(공중 350에서 떨어짐)
    standAt(world, 65);
    world.update(dt, idle);
    expect(world.player.grounded).toBe(true);
    expect(world.drainEvents()).not.toContain('jump');
  });

  it('공중에서 누른 점프는 공중에서 뛰지 않는다(이단 점프 없음)', () => {
    const world = new World(testLevel({ solids: [floor] }));
    world.player.y = 100; world.player.grounded = false;
    world.update(dt, jump);
    expect(world.player.vy).toBeGreaterThan(0);
    expect(world.drainEvents()).toEqual([]);
  });
});
