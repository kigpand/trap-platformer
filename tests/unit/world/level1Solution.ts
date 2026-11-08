import { LEVEL_1 } from '../../../src/game/world/level';
import type { Step } from './solution';

// 레벨 1 해법 입력(구간별). Level1.test.ts와, 같은 입력을 브라우저에서 재생하는 E2E(tests/e2e/fakeClear.spec.ts)가 함께 쓴다.
export const ceiling = LEVEL_1.fallingCeilings[0];
export const spikes = LEVEL_1.popUpSpikes[0];
export const dodge = LEVEL_1.dodgingPlatforms[0];

// 맵 곳곳에 흩어 둔 평범한 파이프·언덕(함정 아님)은 앞에서 한 번 뛰어 넘거나 오른다. 해당 구간의 맨 앞(또는 끝)에 붙여 둬서,
// 그 구간부터 시작하는 체크포인트 해법에도 들어간다.
const over = (x: number): Step[] => [{ run: x - 20 }, { jump: true }];
export const HILL_AFTER_DODGE: Step[] = over(3380); // 2단 언덕(단 30px — 한 번에 꼭대기로), 내려갈 때는 달리기만
export const PIPE_BEFORE_GEM: Step[] = [{ run: 4600 }]; // 트램펄린(4430)이 파이프(4500)를 넘겨 준다 — 달리기만 하면 된다
export const PIPE_BEFORE_ICE: Step[] = over(5950); // 체크포인트 5(5800)에서 떨어져 착지한 뒤 뛸 거리를 둔다
export const HILL_BEFORE_RHYTHM: Step[] = [...over(6950), { jump: true }]; // 단 40px — 두 번 뛰어 꼭대기로
export const PIPE_AFTER_SHADOW: Step[] = over(9500);
export const PIPE_BEFORE_SPRING: Step[] = over(11150);

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
  ...HILL_AFTER_DODGE,
];
// 가짜 클리어는 N을 누르지 않고 그냥 지나간다. 보석은 무시하고 구덩이를 넘는다.
export const FAKE_CLEAR_AND_GEM: Step[] = [...PIPE_BEFORE_GEM, { run: 4795 }, { jump: true }];
export const CORRIDOR: Step[] = [{ run: 5595 }, { jump: true }]; // 천장 통로와 가짜 벽을 멈추지 않고 지나 구덩이를 넘는다
export const ICE: Step[] = [...PIPE_BEFORE_ICE, { run: 6495 }, { jump: true }]; // 얼음 끝까지 달리던 그대로 뛴다
export const RHYTHM: Step[] = [
  ...HILL_BEFORE_RHYTHM,
  { run: 7398 }, { waitUntil: (w) => w.lifeTime % 2 < 1 / 60 }, // 첫 발판이 막 나타날 때
  { jump: true }, { jump: true }, { jump: true }, // 첫 발판 → 두 번째 발판(0.5초 늦게 나타남) → 건너편
];
export const SHADOW: Step[] = [{ run: 8295 }, { jump: true }, { run: 8695 }, { jump: true }, ...PIPE_AFTER_SHADOW]; // 멈추지 않고 달리며 구덩이만 넘는다
// 지형지물 구간: 파이프를 넘고, 적이 나오는 파이프 앞에서 기다렸다 내려온 적을 넘고 파이프를 넘는다. 가라앉는 파이프는 올라서자마자
// 다시 뛰어 언덕 꼭대기에 내려서고, 굴러오는 돌을 제자리에서 넘는다.
export const pipeEnemy = LEVEL_1.pipeEnemies[0];
export const stone = LEVEL_1.rollingStones[0];
export const TERRAIN: Step[] = [
  { run: 9860 }, { jump: true }, // 소개용 파이프(9880)
  { run: pipeEnemy.trigger.x + 30 },
  { waitUntil: (w) => { const e = w.pipeEnemies[0].enemy; return w.pipeEnemies[0].phase === 'patrolling' && !!e && e.vx < 0 && e.x - (w.player.x + w.player.width) < 40; } },
  { jump: true }, // 다가오는 적을 넘는다
  { run: pipeEnemy.pipe.x - 20 }, { jump: true }, // 적이 왼쪽 끝에서 돌아오기 전에 파이프를 넘는다
  { run: 10325 }, { jump: true }, { jump: true }, // 가라앉는 파이프에 올라서자마자 다시 뛰어 언덕 꼭대기로(돌이 나타난다)
  { waitUntil: (w) => w.rollingStones[0].phase === 'rolling' && w.rollingStones[0].x - (w.player.x + w.player.width) < 40 },
  { hop: true }, // 굴러오는 돌을 넘는다
];
export const SPRING_AND_GOAL: Step[] = [...PIPE_BEFORE_SPRING, { run: 11585 }, { jump: true }, { run: LEVEL_1.goal.x + 20 }]; // 스프링 타일을 넘는다
export const TAUNTING = [...FAKE_CLEAR_AND_GEM, ...CORRIDOR, ...ICE, ...RHYTHM, ...SHADOW, ...TERRAIN, ...SPRING_AND_GOAL];
// 스폰에서 가짜 깃발까지.
export const TO_FAKE_FLAG: Step[] = [...ORIGINAL, ...VANISHING_AND_CEILING, ...SPIKES, ...DODGE, { run: fakeFlag().x + 10 }];
export const FULL = [...ORIGINAL, ...VANISHING_AND_CEILING, ...SPIKES, ...DODGE, ...TAUNTING];
export function fakeFlag() { return LEVEL_1.fakeGoals[0].flag; }
