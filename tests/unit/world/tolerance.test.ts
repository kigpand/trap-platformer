import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { testLevel } from './fixtures';
import type { Step } from './solution';
import { jumpSlack } from './tolerance';

describe('jumpSlack', () => {
  // 화살 한 발이 시간에 맞춰 날아온다. 첫 제자리 뛰기 뒤 117스텝을 기다렸다가 두 번째로 뛰면 화살을 넘는다(92~119스텝 사이만 성공).
  // 첫 뛰기를 늦추면(바로 앞이 대기라 그 자리에서 더 기다림) 두 번째도 같이 늦어지므로, 첫 뛰기의 늦게 여유는 2프레임뿐이다 — 두 번째 뛰기는 첫 뛰기 뒤 다섯 번째 명령이다.
  const level = testLevel({
    width: 3000, solids: [{ x: 0, y: 500, width: 3000, height: 120 }],
    arrowTraps: [{ trigger: { x: 0, y: 300, width: 200, height: 200 }, arrows: [{ y: 484, delay: 0, fromX: 1500, toX: 0 }] }],
  });
  const steps: Step[] = [{ run: 300 }, { wait: 0 }, { hop: true }, { wait: 117 / 60 }, { wait: 0 }, { wait: 0 }, { wait: 0 }, { hop: true }, { wait: 2 }];

  it('checks a shifted jump through the end of the solution, not only the next three commands (Codex review)', () => {
    const [first] = jumpSlack(() => new World(level), steps, 3);
    expect(first.index).toBe(2);
    expect(first.late).toBe(2); // 뒤의 세 명령까지만 보던 예전 방식은 두 번째 뛰기를 보지 않아 4로 셌다
  });
});
