import type { World } from '../../../src/game/world/World';
import { playSolution, type Step } from './solution';

// 해법 입력의 시간 여유(사람 손 여유) 측정. 해법의 점프마다 그 직전 명령을 바꿔 몇 프레임 일찍·늦게 눌러도
// 해법 끝까지 사망 없이 가는지 잰다(60프레임 = 1초).
// - 직전이 { run: x }면: 일찍 = x를 3.5px(한 스텝 거리)씩 줄임, 늦게 = 그 자리에서 →를 n스텝 더 누름
// - 직전이 시간을 쓰는 명령(조건 대기·조건까지 달리기·정해진 스텝 수)이면: 원래 해법에서 그 명령이 쓴 스텝 수 k를 세어,
//   일찍 = 같은 입력을 k − n스텝만 넣고 바로 뜀(조건이 참이 되기 n스텝 전에 뜀), 늦게 = 명령 뒤 n스텝 더 기다림.
//   예전엔 이 경우 늦게만 재서, 조건을 넉넉한 쪽 끝에 맞춘 해법(화살이 40px 앞에 오면 뜀)은 실제 여유(약 28프레임)보다
//   훨씬 작게(4~5프레임) 셌다.
// - 직전이 점프·자동 플레이면 일찍은 잴 수 없어 0으로 센다(earlyMeasured = false).
// 바꾼 점프 뒤의 명령은 해법 끝까지 그대로 다시 실행한다 — 뒤의 몇 명령만 보면, 점프 시점이 밀려 한참 뒤의 시간 함정에서
// 실패하는 경우를 여유로 셌다(Codex 리뷰). measured는 여유를 잴 점프가 있는 앞쪽 명령 수, 나머지는 끝까지 확인만 하는 명령이다.
// limit은 한쪽으로 잴 최대 프레임 수다(실행 시간을 묶는다 — 하한 확인에는 아래 need와 함께 need − 1이면 된다).
// 맵 확장 뒤 일회용으로 쟀던 측정(레벨 3 박자 발판이 0~1프레임만 허용함을 찾음)을 레벨 4부터 테스트로 남긴다.
export interface JumpSlack { index: number; early: number; late: number; total: number; earlyMeasured: boolean }
// need를 주면 하한 확인용으로만 잰다: 늦게 쪽을 잰 뒤 이미 합계가 need 이상이면 일찍 쪽은 재지 않는다(그때 early는 0으로 남아
// 실제 여유보다 작게 나온다). 합계가 need 이상인지는 limit = need − 1과 함께 쓰면 끝까지 잰 것과 같다 — 한쪽이 need − 1에 닿으면
// 그것만으로 합계가 need 이상이고, 둘 다 닿지 않으면 둘 다 정확한 값이기 때문이다. 점프 여유 표(scripts/slack.js)는 need 없이 끝까지 잰다.
export function jumpSlack(make: () => World, steps: readonly Step[], measured = steps.length, limit = 30, need?: number): JumpSlack[] {
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
    const held = heldInput(prev);
    const frames = run === null && held !== null ? framesUsed(make, head, prev) : null;
    const shifted = (n: number): Step[] | null => {
      if (n > 0) return [...head, prev, run !== null ? { right: n } : { wait: n / 60 }, ...tail];
      if (run !== null) return [...head, { run: run - 3.5 * -n }, ...tail];
      if (frames === null || held === null || frames + n < 0) return null;
      const k = frames + n; // n < 0: 원래보다 −n스텝 일찍 끝낸다
      return [...head, held === 1 ? { right: k } : held === -1 ? { left: k } : { wait: k / 60 }, ...tail];
    };
    let late = 0;
    while (late < limit && ok(shifted(late + 1) ?? [])) late++;
    let early = 0;
    while (early < limit && (need === undefined || early + late + 1 < need)) { const v = shifted(-(early + 1)); if (!v || !ok(v)) break; early++; }
    out.push({ index: i, early, late, total: early + late + 1, earlyMeasured: run !== null || frames !== null });
  }
  return out;
}

// 시간을 쓰는 명령이 그동안 넣는 좌우 입력(→ 1, ← −1, 가만히 0). 점프·자동 플레이·x까지 달리기는 null(위에서 따로 다룬다).
function heldInput(step: Step): -1 | 0 | 1 | null {
  if ('waitUntil' in step || 'wait' in step) return 0;
  if ('runUntil' in step || 'right' in step) return 1;
  if ('leftUntil' in step || 'left' in step) return -1;
  return null;
}

// 원래 해법에서 head를 실행한 뒤 step 하나가 쓴 스텝 수.
function framesUsed(make: () => World, head: readonly Step[], step: Step): number {
  const world = make();
  playSolution(world, head);
  let count = 0;
  const update = world.update.bind(world);
  world.update = (dt, input) => { count++; update(dt, input); };
  playSolution(world, [step]);
  return count;
}
