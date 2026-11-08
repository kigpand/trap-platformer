import type { World } from '../../../src/game/world/World';
import type { Step } from './solution';

// 레벨 4 해법 입력(구간별). Level4.test.ts와 점프 여유 표(scripts/slack.js)가 함께 쓴다.
export const mirror = (w: World) => w.mirrorEnemies[0];
export const ambusher = (w: World) => w.ambushes[0].enemy;
export const arrowNear = (i: number, px: number) => (w: World) => { const a = w.arrowTraps[0].arrows[i]; return a.phase === 'flying' && a.x <= w.player.x + w.player.width + px; };
// 맵 곳곳의 평범한 파이프·언덕은 앞에서 뛰어 넘거나 오른다. 해당 구간의 끝에 붙여 체크포인트 해법에도 들어간다.
const over = (x: number): Step[] => [{ run: x - 20 }, { jump: true }];
// 1. 그림자가 쫓아오는 사라지는 땅 위로 쏟아지는 적: 멈추면 그림자, 그대로 달리면 적 — 달리면서 적을 넘는다.
export const SHADOW_DROPS: Step[] = [{ run: 1676 }, { jump: true }, { run: 1965 }, { jump: true }];
// 2. 얼음 위 좌우 반전: 반전되면 ←로 미끄러짐을 이어 가고, 풀리면 얼음 끝 구덩이를 넘은 뒤 솟는 가시를 넘는다.
export const ICE_REVERSE_SPIKES: Step[] = [
  { run: 2815 }, { jump: true }, { runUntil: (w) => w.reverse !== null }, { leftUntil: (w) => w.reverse === null },
  { run: 3486 }, { jump: true }, { run: 3677 }, { jump: true },
  ...over(3950), { jump: true }, ...over(4350), // 2단 언덕(두 번 뛰어 꼭대기로)과 파이프
];
// 3. 박자 발판 높이로 날아오는 낮은 화살: 첫 화살은 박자대로 뛰는 사이 발밑으로 지나가고, 둘째는 내리자마자 제자리에서 넘는다.
export const RHYTHM_ARROWS: Step[] = [
  { run: 4998 }, { waitUntil: (w) => w.lifeTime % 1.8 < 1 / 60 }, { jump: true }, { jump: true }, { jump: true }, { jump: true },
  { run: 5560 }, { waitUntil: arrowNear(1, 80) }, { hop: true }, { waitUntil: (w) => w.arrowTraps[0].arrows[1].phase === 'gone' },
];
// 4. 내려오는 천장 통로 안의 따라 뛰는 적: 적이 먼 끝에서 돌아설 때 들어가, 마주 오면 제자리에서 뛰어 머리 위로 넘긴다.
// 통로를 나오면 떨어지는 천장 — 한 발 들어가 떨어뜨리고 물러섰다가 넘는다.
export const CEILING_MIRROR: Step[] = [
  { run: 6540 }, { waitUntil: (w) => mirror(w).enemy.vx < 0 && mirror(w).enemy.x >= 7300 - 28 - 4 },
  { runUntil: (w) => mirror(w).enemy.x - (w.player.x + w.player.width) <= 50 }, { hop: true },
  { waitUntil: (w) => !mirror(w).airborne && mirror(w).enemy.x + mirror(w).enemy.width < w.player.x - 10 },
  { run: 7565 }, { right: 4 }, { left: 20 }, { wait: 1 }, { run: 7560 }, { jump: true },
  ...over(8000), { jump: true }, // 3단 언덕(단 30px — 두 번 뛰어 꼭대기로)
];
// 5. "여기서 점프!" 표지판 = 무거운 신발 구역 = 착지 예측 가시 구역: 구역 앞에서 보통 점프로 넘는다.
export const HEAVY_SPIKES: Step[] = [{ run: 9135 }, { jump: true }];
// 6. 돌덩이에 쫓기며 가짜 벽을 그대로 지나, 세 번째 착지 발판 위 장애물 셋을 두 번만 착지해 넘는다(둘째 점프로 B를 넘어 C 위에 선다).
export const BOULDER_COUNTING: Step[] = [{ run: 11600 }, { jump: true }, { run: 11765 }, { jump: true }, ...over(12300)];
// 7. 숨겨진 블록 틈을 뛰어넘고, 낙하 발판에 내리자마자 다시 뛰고, 기습 적은 먼 끝에서 돌아올 때 마주 넘는다.
export const HIDDEN_FALLING_AMBUSH: Step[] = [
  { run: 12860 }, { jump: true }, { run: 13050 }, { jump: true }, { jump: true },
  { run: 13470 }, { waitUntil: (w) => { const e = ambusher(w); return !!e && e.vx < 0 && e.x >= 13760 - 28 - 40; } },
  { runUntil: (w) => { const e = ambusher(w); return !!e && e.x - (w.player.x + w.player.width) <= 45; } }, { jump: true },
  ...over(14100), { run: 14378 }, { jump: true }, // 파이프를 넘고, 진흙 너머 발판(14380)에 올라갔다 끝에서 내려온다
];
// 8. 도망가는 발판이 투명 블록 아래로 비켜선다: 가장자리보다 일찍 뛰어 비켜선 발판에 내리고, 스프링 앞 좁은 땅에 내려 스프링을 넘는다.
export const DODGE_INVISIBLE_SPRING: Step[] = [{ run: 14655 }, { jump: true }, { run: 14830 }, { jump: true }, { jump: true }];
export const BACK_PIT: Step[] = [...over(15400), { run: 15900 }, { jump: true }]; // 날려버리는 점프가 떨어뜨리는 뒤쪽 구덩이
// 9. 조건부 함정(머뭇거림) 다음 날려버리는 점프(가장자리)를 피해 일찍 뛰고, 가짜 안전지대를 넘는다.
export const CONDITIONAL_FLING_HAZARD: Step[] = [{ run: 16410 }, { jump: true }, { run: 16655 }, { jump: true }];
// 끝: "진짜 끝!" 표지판 → 가짜 체크포인트를 넘고 → 가짜 클리어 깃발을 멈추지 않고 지나 → 세 번 도망가는 목표를 쫓는다.
export const FINALE: Step[] = [{ run: 16955 }, { jump: true }, { run: 17780 }, { jump: true }, { run: 18110 }, { jump: true }, { run: 18560 }];

export const FROM_SPAWN: Step[] = [...SHADOW_DROPS, ...ICE_REVERSE_SPIKES];
export const FROM_CP1: Step[] = [...RHYTHM_ARROWS, ...CEILING_MIRROR];
export const FROM_CP2: Step[] = [...HEAVY_SPIKES, ...BOULDER_COUNTING];
export const FROM_CP3: Step[] = [...HIDDEN_FALLING_AMBUSH, ...DODGE_INVISIBLE_SPRING, ...BACK_PIT];
export const FROM_CP4: Step[] = [...CONDITIONAL_FLING_HAZARD, ...FINALE];
export const FULL: Step[] = [...FROM_SPAWN, ...FROM_CP1, ...FROM_CP2, ...FROM_CP3, ...FROM_CP4];
