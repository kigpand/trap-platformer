import type { InputState, World } from '../../../src/game/world/World';
import { shouldJump } from './autopilot';

// 트롤 함정은 "보이는 것을 피하는" 자동 플레이로 깰 수 없어, 레벨마다 해법을 실제 입력 명령으로 적는다
// (docs/traps-spec.md 공통 규칙의 "해법 입력"). 텔레포트 없이 입력만 넣으며, 사망하면 그 자리에서 멈춘다.
export type Step =
  | { auto: number } // 오른쪽 끝이 x에 닿을 때까지 자동 플레이(보이는 함정·적 회피)로 간다
  | { run: number } // 오른쪽 끝이 x에 닿을 때까지 →만 누른다(점프 없음)
  | { runUntil: (world: World) => boolean } // 조건이 참이 될 때까지 →만 누른다(예: 마주 오는 적과의 거리)
  | { leftUntil: (world: World) => boolean } // 조건이 참이 될 때까지 ←만 누른다(예: 좌우 반전이 풀릴 때까지)
  | { waitUntil: (world: World) => boolean } // 조건이 참이 될 때까지 가만히 있는다(예: 적이 돌아올 때까지)
  | { jump: true } // →와 함께 점프하고 착지할 때까지 →를 누른다
  | { hop: true } // 제자리에서 점프하고 착지할 때까지 기다린다
  | { right: number } // →를 n스텝 누른다
  | { left: number } // ←를 n스텝 누른다
  | { wait: number }; // n초 동안 가만히 있는다

const dt = 1 / 60;
const MAX_STEPS = 60 * 20; // 명령 하나가 20초를 넘기면 해법이 막힌 것으로 본다
const input = (horizontal: -1 | 0 | 1, jumpPressed = false) => ({ horizontal, jumpPressed, restartPressed: false });

// 명령을 차례로 실행한다. 반환값은 실행을 마친 명령 수(사망·막힘이면 그 명령 번호에서 멈춘다).
export function playSolution(world: World, steps: readonly Step[]): number {
  const deaths = world.deaths;
  const alive = () => world.deaths === deaths;
  const rightEdge = () => world.player.x + world.player.width;
  const until = (stop: () => boolean, next: () => ReturnType<typeof input>): boolean => {
    for (let i = 0; i < MAX_STEPS; i++) {
      if (!alive()) return false;
      if (stop()) return true;
      world.update(dt, next());
    }
    // 마지막(1200번째) 업데이트 직후에 처음 참이 된 조건도 제한 안에서 성립한 것으로 본다(Codex 리뷰).
    return alive() && stop();
  };
  for (let n = 0; n < steps.length; n++) {
    const s = steps[n];
    let ok = true;
    if ('auto' in s) {
      ok = until(() => rightEdge() >= s.auto, () => {
        const solids = [...world.level.solids, ...world.dynamicSolids()];
        const obstacles = [...world.level.hazards, ...world.enemies, ...world.ambushes.flatMap((a) => (a.enemy ? [a.enemy] : []))];
        return input(1, shouldJump(world.player, solids, obstacles));
      });
    } else if ('run' in s) {
      ok = until(() => rightEdge() >= s.run, () => input(1));
    } else if ('runUntil' in s) {
      ok = until(() => s.runUntil(world), () => input(1));
    } else if ('leftUntil' in s) {
      ok = until(() => s.leftUntil(world), () => input(-1));
    } else if ('waitUntil' in s) {
      ok = until(() => s.waitUntil(world), () => input(0));
    } else if ('jump' in s) {
      world.update(dt, input(1, true));
      ok = until(() => world.player.grounded, () => input(1));
    } else if ('hop' in s) {
      world.update(dt, input(0, true));
      ok = until(() => world.player.grounded, () => input(0));
    } else {
      // 스텝 수가 정해진 명령도 다른 명령과 같은 20초 제한을 받는다 — 넘으면 잘못 적은 해법으로 보고 막힘으로 처리한다(Codex 리뷰).
      const count = 'right' in s ? s.right : 'left' in s ? s.left : Math.round(s.wait * 60);
      if (count > MAX_STEPS) return n;
      const horizontal = 'right' in s ? 1 : 'left' in s ? -1 : 0;
      for (let i = 0; i < count && alive(); i++) world.update(dt, input(horizontal));
    }
    if (!ok || !alive()) return n;
  }
  return steps.length;
}

// 하늘에서 쏟아지는 적(#13) 하나를 넘는 해법: 착지해 순찰 중인 적이 먼 끝에서 돌아올 때까지 기다렸다가(순찰 구간 밖에서),
// 마주 오는 적을 45px 앞에서 뛰어 넘는다. 순찰 위상에 상관없이 같은 방식으로 넘을 수 있다.
export function jumpSkyDropHeadOn(group: number, index: number): Step[] {
  return [
    { waitUntil: (w) => { const se = w.skyDrops[group].enemies[index]; return se.phase === 'patrolling' && !!se.enemy && se.enemy.vx < 0 && se.enemy.x >= se.drop.maxX - 40; } },
    { runUntil: (w) => { const e = w.skyDrops[group].enemies[index].enemy; return !!e && w.player.grounded && e.x - (w.player.x + w.player.width) <= 45; } },
    { jump: true },
  ];
}

// 해법을 실행하며 스텝마다 넣은 입력을 기록한다 — E2E가 브라우저에서 같은 입력을 같은 스텝 순서로 재생할 때 쓴다.
export function recordInputs(world: World, steps: readonly Step[]): InputState[] {
  const recorded: InputState[] = [];
  const update = world.update.bind(world);
  world.update = (dt, input) => { recorded.push({ ...input }); update(dt, input); };
  const done = playSolution(world, steps);
  world.update = update;
  if (done !== steps.length) throw new Error(`solution stopped at step ${done}`);
  return recorded;
}
