import type { Medal, MedalTier } from '../game/world/medals';

export const MEDAL_NAMES: Readonly<Record<MedalTier, string>> = { gold: '금메달', silver: '은메달', bronze: '동메달' };
export const medalLabel = (medal: Medal): string => `${MEDAL_NAMES[medal.tier]}${medal.flawless ? ' · 노데스' : ''}`;

// 메달 동전(색으로 등급, 노데스면 작은 별). 글자 없이 그림 이름(aria-label)으로 읽힌다 — 옆 글자(시간 등)에 섞이지 않게.
export function MedalBadge({ medal, large = false }: { medal: Medal; large?: boolean }) {
  const label = medalLabel(medal);
  return <span className={`medal medal-${medal.tier}${medal.flawless ? ' is-flawless' : ''}${large ? ' medal-lg' : ''}`} role="img" aria-label={label} title={label} />;
}
