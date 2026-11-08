import type { World } from '../../../src/game/world/World';
import type { Step } from './solution';

// 레벨 2 해법 입력(구간별). Level2.test.ts와 점프 여유 표(scripts/slack.js)가 함께 쓴다.
export const mirror = (w: World) => w.mirrorEnemies[0];
// 맵 곳곳의 평범한 파이프·언덕은 앞에서 뛰어 넘거나 오른다. 해당 구간의 끝(또는 중간)에 붙여 체크포인트 해법에도 들어간다.
const over = (x: number): Step[] => [{ run: x - 20 }, { jump: true }];
export const ORIGINAL: Step[] = [{ auto: 2060 }]; // 낙하 발판 → 갑자기 출현하는 적 → 체크포인트 → 가짜 안전지대 → 왕복 적 → 체크포인트 2
export const INVISIBLE_BLOCK: Step[] = [{ run: 2100 }, { jump: true }]; // 가장자리보다 일찍 뛰어 투명 블록 아래로
export const SPIKES_AND_FAKE: Step[] = [
  { run: 2490 }, { jump: true }, // 24px 가시: 솟기 전에 트리거·가시를 함께 넘는다
  { run: 2740 }, { jump: true }, // 높이 50px 가짜 체크포인트를 넘는다(출발 구간 29px, 실측)
];
export const VANISHING_CEILING_ENEMY: Step[] = [
  { run: 3520 }, // 사라지는 땅은 달려서 지난다(천장 트리거 3530 바로 앞까지)
  { right: 4 }, { left: 20 }, { wait: 1 }, { run: 3535 }, { jump: true }, // 천장을 먼저 떨어뜨리고 넘는다
  // 왕복 적: 천장을 넘어 착지한 곳(약 3656)은 순찰 구간(3700~) 밖이라 안전하다. 적이 멀어지는 중이면 뒤에서 따라잡아
  // 뛰다 적 위로 떨어지므로(상대 속도 90px/s), 적이 먼 끝(3760 이상)에서 돌아올 때까지 기다린 뒤 마주 오는 적을
  // 일찍(45px 앞) 뛰어 넘는다 — 보이는 것만 피하는 자동 플레이(20px 앞)로는 마주 오는 적을 못 넘는다.
  { waitUntil: (w) => w.enemies[1].vx < 0 && w.enemies[1].x >= 3760 },
  { runUntil: (w) => { const e = w.enemies[1]; const gap = e.x - (w.player.x + w.player.width); return w.player.grounded && gap <= 45; } },
  { jump: true },
];
export const DODGE: Step[] = [{ run: 3898 }, { hop: true }, { wait: 0.3 }, { jump: true }, { run: 4070 }, { jump: true }];
export const FLING: Step[] = [{ run: 4395 }, { jump: true }, ...over(4650), { run: 4870 }, { jump: true }]; // 뒤쪽 구덩이를 넘고, 날려버리는 점프 구역 앞에서 일찍 뛴다
export const REVERSE: Step[] = [{ runUntil: (w) => w.reverse !== null }, { leftUntil: (w) => w.reverse === null }, ...over(5600)]; // 반전이 걸리면 ←로 반대편까지
export const HEAVY: Step[] = [{ run: 6175 }, { jump: true }]; // 무거운 신발 구역 앞에서 뛴다
export const LANDING_SPIKES: Step[] = [{ run: 6615 }, { jump: true }]; // 착지 예측 가시 구역 앞에서 뛰어 턱 위로
export const ARROWS: Step[] = [
  { run: 7430 },
  { waitUntil: (w) => { const a = w.arrowTraps[0].arrows[0]; return a.phase === 'flying' && a.x <= w.player.x + w.player.width + 40; } },
  { hop: true }, // 낮은 화살은 뛰어 넘고
  { waitUntil: (w) => w.arrowTraps[0].arrows[1].phase === 'gone' }, // 높은 화살은 서서 머리 위로 보낸다
];
export const MIRROR: Step[] = [
  { run: 8780 }, { waitUntil: (w) => mirror(w).enemy.vx > 0 && mirror(w).enemy.x >= 9150 }, // 적이 먼 끝으로 간 사이
  { run: 9020 }, // 순찰 구간 안으로 들어가
  { waitUntil: (w) => mirror(w).enemy.vx < 0 && mirror(w).enemy.x - (w.player.x + w.player.width) <= 40 }, { hop: true }, // 다가오면 제자리에서 뛴다
  { waitUntil: (w) => !mirror(w).airborne && mirror(w).enemy.x + mirror(w).enemy.width < w.player.x - 10 }, // 적이 머리 위로 넘어갔다
  ...over(9450), { jump: true }, // 2단 언덕(단 40px — 두 번 뛰어 꼭대기로)
];
export const pipeEnemy = (w: World) => w.pipeEnemies[0];
export const COUNTING: Step[] = [
  { run: 10115 }, { jump: true }, { run: 10400 }, { jump: true },
  { run: 10610 }, { jump: true }, // 트리거를 밟고 한쪽 통과 발판 위로 — 파이프에서 나온 적은 발판 아래를 왕복한다
  { waitUntil: (w) => { const pe = pipeEnemy(w); return pe.phase === 'patrolling' && !!pe.enemy && pe.enemy.vx < 0 && pe.enemy.x < 10660; } },
  ...over(10800), // 적이 왼쪽으로 지나간 사이 발판 끝에서 내려와 파이프를 넘는다
]; // 발끝까지 버티다 늦게 뛰어 두 번만 착지, 발판(10620)에 올라갔다 끝에서 내려와 파이프
export const BOULDER: Step[] = [{ run: 12295 }, { jump: true }, ...over(13300), { jump: true }, { run: 13815 }, { jump: true }]; // 돌덩이가 멈춘 뒤 3단 언덕, 바람을 타고 넓은 구덩이(13820-14020)
export const FLEEING_GOAL: Step[] = [{ run: 14610 }, { wait: 0.4 }, { run: 14780 }, { jump: true }, { run: 15280 }];
export const TAUNTING: Step[] = [...FLING, ...REVERSE, ...HEAVY, ...LANDING_SPIKES, ...ARROWS, ...MIRROR, ...COUNTING, ...BOULDER, ...FLEEING_GOAL];
export const AFTER_CP2: Step[] = [...INVISIBLE_BLOCK, ...SPIKES_AND_FAKE, ...VANISHING_CEILING_ENEMY, ...DODGE, ...TAUNTING];
export const FULL: Step[] = [...ORIGINAL, ...AFTER_CP2];
