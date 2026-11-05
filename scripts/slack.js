// 점프 여유 표(docs/roadmap.md 백로그의 "사람이 직접 플레이해 확인할 빡빡한 구간"을 다시 잴 때). `pnpm slack [레벨 번호…]`로 실행한다.
// 레벨마다 스폰에서 해법 입력(tests/unit/world/levelNSolution.ts)을 그대로 쓰고, 점프·제자리 점프마다 몇 프레임 일찍·늦게 눌러도
// 해법 끝까지 사망 없이 가는지 tests/unit/world/tolerance.ts의 jumpSlack으로 잰다(60프레임 = 1초, 한쪽 최대 30프레임).
// 바로 앞 명령이 "x까지 달리기"가 아니면 늦게만 잴 수 있어 일찍은 "-"로 표시한다. 합계가 6프레임 미만이면 "<6"을 붙인다
// (docs/game-design.md "사람 손 여유 하한" — 테스트로 지키는 것은 레벨 4뿐). 자동 플레이 구간({ auto })의 점프는 재지 않는다.
// TypeScript 모듈은 Vite의 SSR 모듈 로더로 불러온다(새 의존성 없이).
import { createServer } from 'vite';

const LIMIT = 30;
const server = await createServer({ logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
try {
  const load = (path) => server.ssrLoadModule(path);
  const { World } = await load('/src/game/world/World.ts');
  const { LEVELS } = await load('/src/game/world/level.ts');
  const { playSolution } = await load('/tests/unit/world/solution.ts');
  const { jumpSlack } = await load('/tests/unit/world/tolerance.ts');
  const solutions = await Promise.all(LEVELS.map((_, i) => load(`/tests/unit/world/level${i + 1}Solution.ts`).then((m) => m.FULL)));

  const wanted = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= LEVELS.length);
  const describe = (step) => ('run' in step ? `run ${step.run}` : Object.keys(step)[0]);
  for (const [i, level] of LEVELS.entries()) {
    if (wanted.length > 0 && !wanted.includes(i + 1)) continue;
    const steps = solutions[i];
    const make = () => new World(level);
    const started = Date.now();
    const rows = jumpSlack(make, steps, steps.length, LIMIT).map((s) => {
      const world = make();
      playSolution(world, steps.slice(0, s.index)); // 점프 직전 위치
      const prev = steps[s.index - 1];
      const fmt = (n) => (n >= LIMIT ? `${LIMIT}+` : String(n));
      return {
        step: s.index,
        kind: 'hop' in steps[s.index] ? 'hop' : 'jump',
        x: Math.round(world.player.x),
        after: describe(prev),
        early: 'run' in prev ? fmt(s.early) : '-',
        late: fmt(s.late),
        total: s.total < 6 ? `${s.total} <6` : String(s.total),
      };
    });
    console.log(`\n레벨 ${i + 1} — 점프 ${rows.length}개, ${((Date.now() - started) / 1000).toFixed(1)}초`);
    console.table(Object.fromEntries(rows.map(({ step, ...row }) => [step, row]))); // 첫 열 = 해법 명령 번호
  }
} finally {
  await server.close();
}
