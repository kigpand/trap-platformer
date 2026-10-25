import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { playSolution } from './solution';
import { testLevel } from './fixtures';

// 해법 입력 러너 자체의 규칙. 레벨 테스트가 이 러너의 "완주"를 믿으므로 거짓 성공이 없어야 한다.
const flat = () => new World(testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }] }));

describe('playSolution', () => {
  it('treats any command longer than the 20s limit as blocked, including step and wait commands', () => {
    // 코덱스 리뷰: right/left/wait는 20초 제한 없이 지정한 만큼 돌아, 잘못 적은 긴 명령도 끝까지 실행됐다.
    expect(playSolution(flat(), [{ wait: 21 }])).toBe(0);
    expect(playSolution(flat(), [{ right: 60 * 21 }])).toBe(0);
    expect(playSolution(flat(), [{ left: 60 * 21 }])).toBe(0);
  });

  it('runs commands within the limit and reports how many finished', () => {
    expect(playSolution(flat(), [{ wait: 1 }, { right: 30 }, { left: 10 }])).toBe(3);
  });

  it('stops at the command where the player dies', () => {
    const world = new World(testLevel({ solids: [{ x: 0, y: 500, width: 200, height: 120 }] })); // 200 너머는 구덩이
    world.player.x = 100; world.player.y = 468; world.player.grounded = true;
    expect(playSolution(world, [{ wait: 0.5 }, { right: 120 }, { wait: 1 }])).toBe(1);
    expect(world.deaths).toBe(1);
  });

  it('accepts a condition that first holds exactly at the 20s limit', () => {
    // 코덱스 리뷰: 조건 검사가 매 업데이트 "전"에만 있어, 1200번째 업데이트 직후에야 참이 되는 조건을 실패로 처리했다.
    let updates = 0;
    const world = flat();
    const original = world.update.bind(world);
    world.update = (dt, input) => { updates++; original(dt, input); };
    expect(playSolution(world, [{ runUntil: () => updates >= 60 * 20 }])).toBe(1);
  });
});

