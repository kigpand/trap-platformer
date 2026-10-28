import { LEVEL_1 } from '../../../src/game/world/level';
import type { Step } from './solution';

// 레벨 1 해법 입력(구간별). Level1.test.ts와, 같은 입력을 브라우저에서 재생하는 E2E(tests/e2e/fakeClear.spec.ts)가 함께 쓴다.
export const ceiling = LEVEL_1.fallingCeilings[0];
export const spikes = LEVEL_1.popUpSpikes[0];
export const dodge = LEVEL_1.dodgingPlatforms[0];

// 구간별 해법. 원래 구간은 보이는 것만 피하면 되므로 자동 플레이로 간다.
export const ORIGINAL: Step[] = [{ auto: 1940 }];
export const VANISHING_AND_CEILING: Step[] = [
  { run: ceiling.trigger.x - 10 }, // 사라지는 땅은 멈추지 않고 달려 지나간다
  { right: 4 }, { left: 20 }, { wait: 1 }, // 천장 트리거에 살짝 들어갔다 물러서서 떨어뜨린다
  { run: ceiling.block.x - 25 }, { jump: true }, // 떨어진 블록(높이 40)을 넘는다
];
export const SPIKES: Step[] = [{ run: spikes.trigger.x - 35 }, { jump: true }]; // 가시가 솟기 전에 트리거·가시를 함께 넘는다
export const DODGE: Step[] = [
  { run: dodge.trigger.x + dodge.trigger.width - 2 }, { hop: true }, { wait: 0.3 }, // 제자리 점프로 발판을 먼저 도망가게 한다
  { jump: true }, // 옮겨 간 발판(3120-3180)으로
  { run: dodge.to.x + dodge.platform.width - 10 }, { jump: true }, // 건너편 ground5로
];
// 가짜 클리어는 N을 누르지 않고 그냥 지나간다. 보석은 무시하고 구덩이를 넘는다.
export const FAKE_CLEAR_AND_GEM: Step[] = [{ run: 4795 }, { jump: true }];
export const CORRIDOR: Step[] = [{ run: 5595 }, { jump: true }]; // 천장 통로와 가짜 벽을 멈추지 않고 지나 구덩이를 넘는다
export const ICE: Step[] = [{ run: 6495 }, { jump: true }]; // 얼음 끝까지 달리던 그대로 뛴다
export const RHYTHM: Step[] = [
  { run: 7398 }, { waitUntil: (w) => w.lifeTime % 2 < 1 / 60 }, // 첫 발판이 막 나타날 때
  { jump: true }, { jump: true }, { jump: true }, // 첫 발판 → 두 번째 발판(0.5초 늦게 나타남) → 건너편
];
export const SHADOW: Step[] = [{ run: 8295 }, { jump: true }, { run: 8695 }, { jump: true }]; // 멈추지 않고 달리며 구덩이만 넘는다
export const SPRING_AND_GOAL: Step[] = [{ run: 11585 }, { jump: true }, { run: LEVEL_1.goal.x + 20 }]; // 스프링 타일을 넘는다
export const TAUNTING = [...FAKE_CLEAR_AND_GEM, ...CORRIDOR, ...ICE, ...RHYTHM, ...SHADOW, ...SPRING_AND_GOAL];
// 스폰에서 가짜 깃발까지.
export const TO_FAKE_FLAG: Step[] = [...ORIGINAL, ...VANISHING_AND_CEILING, ...SPIKES, ...DODGE, { run: fakeFlag().x + 10 }];
export const FULL = [...ORIGINAL, ...VANISHING_AND_CEILING, ...SPIKES, ...DODGE, ...TAUNTING];
export function fakeFlag() { return LEVEL_1.fakeGoals[0].flag; }
