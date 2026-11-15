import { describe, expect, it } from 'vitest';
import { World } from '../../../src/game/world/World';
import { testLevel } from './fixtures';
import { playSolution, type Step } from './solution';
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

  it('with need, stops early probes only once the floor is already met, so the floor check is unchanged', () => {
    // 여유가 넉넉한 평지 점프: 늦게 쪽만으로 하한(6)을 채우면 일찍 쪽은 재지 않는다.
    const flat = testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }] });
    const easy: Step[] = [{ run: 300 }, { jump: true }, { run: 900 }];
    const [full] = jumpSlack(() => new World(flat), easy, 2, 5);
    const [quick] = jumpSlack(() => new World(flat), easy, 2, 5, 6);
    expect(full.early + full.late).toBe(10);
    expect(quick).toMatchObject({ late: 5, early: 0, total: 6 });
    // 여유가 빠듯한 점프(늦게 2): need가 있어도 일찍 쪽까지 끝까지 재 같은 값이 나온다.
    const [tight] = jumpSlack(() => new World(level), steps, 3, 5);
    const [tightNeed] = jumpSlack(() => new World(level), steps, 3, 5, 6);
    expect(tightNeed).toEqual(tight);
  });

  it('measures the early side of a jump that follows a wait condition, by firing it frames before the condition holds', () => {
    // 화살이 앞 140px에 오면 제자리에서 뛴다 — 이 조건은 넉넉한 쪽 끝이 아니라 가운데라 일찍·늦게 모두 여유가 있다.
    const near = (px: number) => (w: World) => { const a = w.arrowTraps[0].arrows[0]; return a.phase === 'flying' && a.x <= w.player.x + w.player.width + px; };
    const waiting: Step[] = [{ run: 300 }, { waitUntil: near(140) }, { hop: true }, { wait: 2 }];
    const [slack] = jumpSlack(() => new World(level), waiting, 3);
    expect(slack.earlyMeasured).toBe(true);
    expect(slack.early).toBeGreaterThan(0); // 예전엔 대기 뒤 점프의 일찍 쪽을 재지 않아 0이었다
    expect(slack.late).toBeGreaterThan(0);
    // 같은 순간에 뛰는 정해진 대기(스텝 수를 센 것)와 결과가 같다 — 조건을 그 스텝 수로 바꿔 재기 때문이다.
    const world = new World(level);
    playSolution(world, waiting.slice(0, 1));
    let frames = 0;
    while (!near(140)(world)) { world.update(1 / 60, { horizontal: 0, jumpPressed: false, restartPressed: false }); frames++; }
    const [fixed] = jumpSlack(() => new World(level), [waiting[0], { wait: frames / 60 }, ...waiting.slice(2)], 3);
    expect(slack).toEqual(fixed);
  });

  it('still cannot shift a jump earlier when the command before it is another jump', () => {
    const flat = testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }] });
    const [, second] = jumpSlack(() => new World(flat), [{ run: 300 }, { jump: true }, { jump: true }, { run: 900 }], 3, 5);
    expect(second).toMatchObject({ index: 2, early: 0, earlyMeasured: false });
  });
});
