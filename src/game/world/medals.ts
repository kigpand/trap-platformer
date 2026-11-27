// 레벨별 목표 기록(메달, docs/game-design.md "기록" — 2026-11-26 프로젝트 오너 결정). 기록에서 바로 계산하므로 따로 저장하지 않는다.
// 금: 레벨 해법(tests/unit/world/level*Solution.ts)의 완주 시간 × 1.15 이내, 은: × 1.5 이내, 동: 클리어. 한 번도 죽지 않고
// 클리어하면 노데스 별을 따로 붙인다. 해법 시간(62.5·109.3·107.7·109.8초)에서 올림한 값이며, 배치가 바뀌어 해법이 금을 못 따거나
// 금이 너무 느슨해지면 medals.test.ts가 실패한다.
export type MedalTier = 'gold' | 'silver' | 'bronze';
export interface MedalTimes { readonly gold: number; readonly silver: number }
export interface Medal { readonly tier: MedalTier; readonly flawless: boolean }

export const MEDAL_TIMES: readonly MedalTimes[] = [
  { gold: 72, silver: 94 },
  { gold: 126, silver: 164 }, // 2026-11-27 장애물 코스를 넣어 해법이 97.3 → 109.3초
  { gold: 124, silver: 162 },
  { gold: 127, silver: 165 },
];

// 클리어 기록(시간·사망 수)의 메달. 목표가 없는 레벨(시험용 레벨 등)은 동메달만.
export function medalFor(levelIndex: number, record: { readonly time: number; readonly deaths: number }): Medal {
  const times = MEDAL_TIMES[levelIndex];
  const tier: MedalTier = times && record.time <= times.gold ? 'gold' : times && record.time <= times.silver ? 'silver' : 'bronze';
  return { tier, flawless: record.deaths === 0 };
}
