import type { World } from '../../../src/game/world/World';
import { jumpSkyDropHeadOn, type Step } from './solution';

// 레벨 3 해법 입력(구간별). Level3.test.ts와 점프 여유 표(scripts/slack.js)가 함께 쓴다.
// 맵 곳곳의 평범한 파이프·언덕은 앞에서 뛰어 넘거나 오른다(해당 구간에 붙여 체크포인트 해법에도 들어간다).
const over = (x: number): Step[] => [{ run: x - 20 }, { jump: true }];
export const VANISH_SPIKES: Step[] = [...over(250), { run: 935 }, { jump: true }]; // 사라지는 땅을 달리다 그대로 가시(트리거 앞 10px 구간)
export const INVISIBLE_BLOCK: Step[] = [{ run: 1262 }, { jump: true }]; // 가장자리 46~24px 앞(23px)에서 일찍 뛴다
export const SKY_DROPS_1: Step[] = [
  { run: 1454 }, { left: 10 }, // 트리거만 밟고 조금 물러선다(뒤는 투명 블록 구덩이)
  { waitUntil: (w) => w.skyDrops[0].enemies.every((se) => se.phase === 'patrolling') },
  { run: 1540 }, ...jumpSkyDropHeadOn(0, 0), { run: 1780 }, ...jumpSkyDropHeadOn(0, 1),
];
export const FAKE_CEILING_SPIKES: Step[] = [
  { run: 2258 }, { jump: true }, // 높이 60px 가짜 체크포인트(출발 구간 12px)
  { run: 2465 }, { right: 4 }, { left: 20 }, { wait: 1 }, { run: 2475 }, { jump: true }, // 천장을 떨어뜨리고 넘는다(트리거 2470)
  { run: 2634 }, { jump: true }, // 착지하자마자 두 번째 가시
];
export const DODGE: Step[] = [{ run: 2898 }, { hop: true }, { wait: 0.3 }, { jump: true }, { run: 3070 }, { jump: true }];
export const VANISH_HAZARD: Step[] = [{ run: 3815 }, { jump: true }]; // 두 번째 사라지는 땅 끝(3800) 바로 뒤에서 가짜 안전지대(3840)를 넘는다
export const SKY_DROPS_2: Step[] = [
  { run: 4204 }, { left: 10 }, { waitUntil: (w) => w.skyDrops[1].enemies.every((se) => se.phase === 'patrolling') },
  { run: 4340 }, ...jumpSkyDropHeadOn(1, 0), { run: 4580 }, ...jumpSkyDropHeadOn(1, 1),
];
export const mirror = (w: World) => w.mirrorEnemies[0];
export const arrowNear = (i: number) => (w: World) => { const a = w.arrowTraps[0].arrows[i]; return a.phase === 'flying' && a.x <= w.player.x + w.player.width + 40; };
export const BOULDER_WALL: Step[] = [{ run: 4985 }, { jump: true }, { run: 6295 }, { jump: true }]; // 돌덩이를 달고 가짜 벽을 그대로 지나 구덩이
export const ICE_FLING: Step[] = [...over(6650), { run: 6865 }, { jump: true }, { run: 7375 }, { jump: true }]; // 뒤쪽 구덩이, 얼음 끝 날려버리는 점프 구역 앞에서 뛴다
export const SHADOW_REVERSE: Step[] = [{ runUntil: (w) => w.reverse !== null }, { leftUntil: (w) => w.reverse === null }, { run: 8295 }, { jump: true }];
export const ARROWS_HEAVY: Step[] = [
  { run: 9330 }, { waitUntil: arrowNear(0) }, { hop: true }, // 낮은 화살
  { waitUntil: (w) => w.arrowTraps[0].arrows[1].phase === 'gone' }, // 높은 화살은 서서
  { waitUntil: arrowNear(2) }, { hop: true }, { waitUntil: (w) => w.arrowTraps[0].arrows[2].phase === 'gone' }, // 다시 낮은 화살
  { run: 9975 }, { jump: true }, // 무거운 신발 구역 앞에서
];
export const MIRROR_SPIKES: Step[] = [
  { run: 10380 }, { waitUntil: (w) => mirror(w).enemy.vx > 0 && mirror(w).enemy.x >= 10750 }, { run: 10620 },
  { waitUntil: (w) => mirror(w).enemy.vx < 0 && mirror(w).enemy.x - (w.player.x + w.player.width) <= 40 }, { hop: true },
  { waitUntil: (w) => !mirror(w).airborne && mirror(w).enemy.x + mirror(w).enemy.width < w.player.x - 10 },
  { run: 11215 }, { jump: true }, // "여기서 점프!" 표지판 말과 달리 구역 앞에서 뛰어 턱 위로
];
export const COUNTING: Step[] = [{ run: 11615 }, { jump: true }, { run: 11900 }, { jump: true }];
// 3단 언덕(단 30px)을 두 번 뛰어 오르고 내려와, 적이 나오는 파이프 앞에서 기다렸다 내려온 적을 넘고 파이프를 넘는다.
export const HILL_PIPE_ENEMY: Step[] = [
  ...over(12300), { jump: true },
  { run: 12700 },
  { waitUntil: (w) => { const pe = w.pipeEnemies[0]; return pe.phase === 'patrolling' && !!pe.enemy && pe.enemy.vx < 0 && pe.enemy.x - (w.player.x + w.player.width) < 40; } },
  { jump: true },
  ...over(12900),
]; // 발끝까지 버티다 늦게 뛰어 두 번만 착지
export const RHYTHM: Step[] = [{ run: 13398 }, { waitUntil: (w) => w.lifeTime % 1.8 < 1 / 60 }, { jump: true }, { jump: true }, { jump: true }, { jump: true }];
export const CEILING_FAKE_SPRING: Step[] = [{ run: 15140 }, { jump: true }, ...over(15500), { run: 15835 }, { jump: true }]; // 천장 통로·두 번째 가짜 클리어를 멈추지 않고 지나 스프링을 넘는다
export const FINALE: Step[] = [{ run: 16185 }, { jump: true }, { run: 16534 }, { jump: true }, { run: 16760 }]; // 도망가는 목표·구덩이·가시
export const TAUNTING: Step[] = [...BOULDER_WALL, ...ICE_FLING, ...SHADOW_REVERSE, ...ARROWS_HEAVY, ...MIRROR_SPIKES, ...COUNTING, ...HILL_PIPE_ENEMY, ...RHYTHM, ...CEILING_FAKE_SPRING, ...FINALE];
export const FULL: Step[] = [...VANISH_SPIKES, ...INVISIBLE_BLOCK, ...SKY_DROPS_1, ...FAKE_CEILING_SPIKES, ...DODGE, ...VANISH_HAZARD, ...SKY_DROPS_2, ...TAUNTING];
