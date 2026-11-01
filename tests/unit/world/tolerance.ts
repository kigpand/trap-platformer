import type { World } from '../../../src/game/world/World';
import { playSolution, type Step } from './solution';

// 해법 입력의 시간 여유(사람 손 여유) 측정. 해법의 점프마다 그 직전 명령을 바꿔 몇 프레임 일찍·늦게 눌러도
// 해법 끝까지 사망 없이 가는지 잰다(60프레임 = 1초).
// - 직전이 { run: x }면: 일찍 = x를 3.5px(한 스텝 거리)씩 줄임, 늦게 = 그 자리에서 →를 n스텝 더 누름
// - 직전이 조건 대기 등이면: 늦게만 잴 수 있다(n스텝 더 기다림). 일찍은 0으로 센다.
// 바꾼 점프 뒤의 명령은 해법 끝까지 그대로 다시 실행한다 — 뒤의 몇 명령만 보면, 점프 시점이 밀려 한참 뒤의 시간 함정에서
// 실패하는 경우를 여유로 셌다(Codex 리뷰). measured는 여유를 잴 점프가 있는 앞쪽 명령 수, 나머지는 끝까지 확인만 하는 명령이다.
// limit은 한쪽으로 잴 최대 프레임 수다(실행 시간을 묶는다 — 하한 확인에는 하한보다 크기만 하면 된다).
// 맵 확장 뒤 일회용으로 쟀던 측정(레벨 3 박자 발판이 0~1프레임만 허용함을 찾음)을 레벨 4부터 테스트로 남긴다.
export interface JumpSlack { index: number; early: number; late: number; total: number }
export function jumpSlack(make: () => World, steps: readonly Step[], measured = steps.length, limit = 30): JumpSlack[] {
  const out: JumpSlack[] = [];
  const ok = (variant: Step[]): boolean => {
    const world = make();
    const deaths = world.deaths;
    return playSolution(world, variant) === variant.length && world.deaths === deaths;
  };
  for (let i = 1; i < measured; i++) {
    const s = steps[i];
    if (!('jump' in s) && !('hop' in s)) continue;
    const prev = steps[i - 1];
    const head = steps.slice(0, i - 1);
    const tail = steps.slice(i);
    const run = 'run' in prev ? prev.run : null;
    const shifted = (n: number): Step[] | null => {
      if (n > 0) return [...head, prev, run !== null ? { right: n } : { wait: n / 60 }, ...tail];
      return run === null ? null : [...head, { run: run - 3.5 * -n }, ...tail];
    };
    let late = 0;
    while (late < limit && ok(shifted(late + 1) ?? [])) late++;
    let early = 0;
    while (early < limit) { const v = shifted(-(early + 1)); if (!v || !ok(v)) break; early++; }
    out.push({ index: i, early, late, total: early + late + 1 });
  }
  return out;
}
