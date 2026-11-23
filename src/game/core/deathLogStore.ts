import { DEATH_NAMES } from '../rendering/taunts';
import type { Level } from '../world/level';
import { addDeathMarkAt, type DeathMark, type DeathStatKind } from '../world/World';

// 누적 사망 기록(docs/game-design.md "기록"): 레벨마다 원인별 사망 수와 사망 자리를 브라우저에 쌓아, 런·새로고침이 바뀌어도
// 어디서 자주 죽는지 보게 한다. 플레이어 화면이 아니라 배치 판단용이라 B(디버그)를 켰을 때만 보인다.
export interface DeathLog { readonly kinds: Partial<Record<DeathStatKind, number>>; readonly marks: readonly DeathMark[] }
export const EMPTY_DEATH_LOG: DeathLog = { kinds: {}, marks: [] };
// 저장 크기를 묶는다. 넘으면 새 자리는 더하지 않고(이미 있는 자리의 횟수와 원인별 수는 계속 센다).
export const MAX_LOGGED_MARKS = 500;
const KEY_PREFIX = 'trap-runner:deaths:v1:';

// 레벨 데이터의 짧은 해시(FNV-1a 32비트). 배치가 바뀌면 키가 바뀌어 예전 자리 기록을 더 읽지 않는다 — 옮긴 함정 자리를
// 가리키는 낡은 표식이 섞이지 않게(2026-11-24 프로젝트 오너 결정). 레벨 데이터는 defineLevel로 만든 평범한 객체라 JSON이 결정적이다.
export function levelHash(level: Level): string {
  const text = JSON.stringify(level);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
export const deathLogKey = (level: Level, levelIndex: number): string => `${KEY_PREFIX}${levelIndex + 1}:${levelHash(level)}`;

function isDeathStatKind(key: string): key is DeathStatKind { return Object.hasOwn(DEATH_NAMES, key); }
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

// 깨졌거나 형식이 다른 값(수동 편집, 예전 형식)은 버리고, 알 수 없는 원인·잘못된 표식은 그 항목만 뺀다.
export function parseDeathLog(raw: string | null): DeathLog {
  if (raw === null) return EMPTY_DEATH_LOG;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('kinds' in parsed) || !('marks' in parsed)) return EMPTY_DEATH_LOG;
    const kinds: Partial<Record<DeathStatKind, number>> = {};
    if (typeof parsed.kinds === 'object' && parsed.kinds !== null) {
      for (const [key, value] of Object.entries(parsed.kinds)) if (isDeathStatKind(key) && isCount(value)) kinds[key] = value;
    }
    const marks: DeathMark[] = [];
    if (Array.isArray(parsed.marks)) {
      for (const m of parsed.marks.slice(0, MAX_LOGGED_MARKS)) {
        if (typeof m !== 'object' || m === null || !('x' in m) || !('y' in m) || !('count' in m)) continue;
        const { x, y, count } = m;
        if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y) && isCount(count)) marks.push({ x, y, count });
      }
    }
    return { kinds, marks };
  } catch { return EMPTY_DEATH_LOG; }
}

// 시크릿 모드·저장소 차단에서는 읽기·쓰기가 예외를 던진다 — 빈 기록으로 동작하고 저장은 건너뛴다(다른 설정과 같음).
export function loadDeathLog(level: Level, levelIndex: number): DeathLog {
  try { return parseDeathLog(localStorage.getItem(deathLogKey(level, levelIndex))); } catch { return EMPTY_DEATH_LOG; }
}

// 사망 하나를 더해 저장하고 새 기록을 돌려준다. 저장소를 다시 읽어 더하므로, 같은 레벨을 연 다른 탭의 사망을 덮어쓰지 않는다.
// 저장소가 막혀 있으면 이 탭이 가진 기록(fallback)에 더한다.
export function recordDeath(level: Level, levelIndex: number, fallback: DeathLog, death: { x: number; y: number; kind: DeathStatKind }): DeathLog {
  const key = deathLogKey(level, levelIndex);
  let base = fallback;
  try { base = parseDeathLog(localStorage.getItem(key)); } catch { /* 저장소가 막힘 — 이 탭의 기록에 더한다 */ }
  const marks = base.marks.map((m) => ({ ...m }));
  addDeathMarkAt(marks, death.x, death.y, MAX_LOGGED_MARKS);
  const next: DeathLog = { kinds: { ...base.kinds, [death.kind]: (base.kinds[death.kind] ?? 0) + 1 }, marks };
  try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* 저장 실패 시 이번 세션에만 남는다 */ }
  return next;
}

// 모든 레벨의 누적 사망 기록을 지운다(배치가 바뀌어 더 읽지 않는 예전 해시의 키도 함께). 최고 기록 등 다른 키는 건드리지 않는다.
export function clearDeathLogs(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch { /* 저장소가 막힘 — 지울 것도 없다 */ }
}
