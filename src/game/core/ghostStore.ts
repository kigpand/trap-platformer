import type { GhostPose } from '../rendering/CanvasRenderer';
import type { Level } from '../world/level';
import { levelHash } from './deathLogStore';

// 고스트(docs/game-design.md "기록" — 2026-11-26 프로젝트 오너 결정): 레벨마다 이 브라우저의 가장 빠른 클리어 런을 저장해 두었다가,
// 켜 두면 다음 런에서 반투명 흰 실루엣으로 같은 런 시간에 맞춰 다시 보여 준다. 그림일 뿐 게임에 영향이 없다.
// 프레임은 런 시간 GHOST_STEPS 스텝(1/30초)마다 [x, y, 깃발]을 이어 붙인 수 배열 — 깃발은 1 왼쪽을 봄, 2 공중, 4 움직임.
export interface Ghost { readonly time: number; readonly frames: readonly number[] }
export const GHOST_STEPS = 2;
const FRAMES_PER_SECOND = 60 / GHOST_STEPS;
// 10분 넘는 런은 앞 10분만 담는다(저장 크기를 묶음 — 그보다 긴 런은 최고 기록이 될 일도 거의 없다).
export const MAX_GHOST_FRAMES = FRAMES_PER_SECOND * 60 * 10;
const KEY_PREFIX = 'trap-runner:ghost:v1:';
const ENABLED_KEY = 'trap-runner:ghost-enabled';
// 레벨 배치가 바뀌면 키가 바뀌어 예전 고스트를 더 읽지 않는다(누적 사망 기록과 같은 해시).
export const ghostKey = (level: Level, levelIndex: number): string => `${KEY_PREFIX}${levelIndex + 1}:${levelHash(level)}`;

const FACING_LEFT = 1, AIRBORNE = 2, MOVING = 4;
export function encodePose(p: { x: number; y: number; facing: number; grounded: boolean; vx: number }): [number, number, number] {
  return [Math.round(p.x), Math.round(p.y), (p.facing < 0 ? FACING_LEFT : 0) | (p.grounded ? 0 : AIRBORNE) | (p.vx !== 0 ? MOVING : 0)];
}

// 런 시간 t초의 고스트 자세. 두 프레임 사이는 선형으로 잇되, 크게 순간이동한 곳(사망 뒤 체크포인트로 돌아감)은 잇지 않는다.
// 기록이 끝난 뒤(고스트가 클리어한 뒤)에는 null.
const TELEPORT = 40;
export function ghostPoseAt(ghost: Ghost, t: number): GhostPose | null {
  const count = ghost.frames.length / 3;
  const f = Math.max(0, t) * FRAMES_PER_SECOND;
  const i = Math.floor(f);
  if (i >= count) return null;
  const at = (k: number) => ({ x: ghost.frames[k * 3], y: ghost.frames[k * 3 + 1], flags: ghost.frames[k * 3 + 2] });
  const a = at(i);
  const b = i + 1 < count ? at(i + 1) : a;
  const jump = Math.abs(b.x - a.x) > TELEPORT || Math.abs(b.y - a.y) > TELEPORT;
  const s = jump ? 0 : f - i;
  return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, facing: a.flags & FACING_LEFT ? -1 : 1, airborne: (a.flags & AIRBORNE) !== 0, moving: (a.flags & MOVING) !== 0 };
}

// 깨졌거나 형식이 다른 값은 고스트가 없는 것으로 본다(누적 사망 기록·최고 기록과 같음).
export function parseGhost(raw: string | null): Ghost | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('time' in parsed) || !('frames' in parsed)) return null;
    const { time, frames } = parsed;
    if (typeof time !== 'number' || !(time >= 0) || !Array.isArray(frames) || frames.length === 0 || frames.length % 3 !== 0 || frames.length > MAX_GHOST_FRAMES * 3) return null;
    const nums: number[] = [];
    for (const v of frames) {
      if (typeof v !== 'number' || !Number.isFinite(v)) return null;
      nums.push(v);
    }
    return { time, frames: nums };
  } catch { return null; }
}

export function loadGhost(level: Level, levelIndex: number): Ghost | null {
  try { return parseGhost(localStorage.getItem(ghostKey(level, levelIndex))); } catch { return null; }
}

// 저장한 고스트보다 빨리 클리어했을 때만 저장한다(다른 탭이 그사이 더 빠른 고스트를 저장했으면 그대로 둔다). 저장한 고스트를 돌려준다.
export function saveGhostIfFaster(level: Level, levelIndex: number, run: Ghost): Ghost {
  const stored = loadGhost(level, levelIndex);
  if (stored && stored.time <= run.time) return stored;
  try { localStorage.setItem(ghostKey(level, levelIndex), JSON.stringify(run)); } catch { /* 저장 실패(용량·차단) 시 이번 세션에만 */ }
  return run;
}

// 지금 레벨들의 키가 아닌 고스트(레벨 배치가 바뀌어 더 읽지 않는 예전 해시, 없어진 레벨)를 지운다. 고스트 하나가 수십 KB라 배치를
// 바꿀 때마다 쌓이지 않게 한다(2026-11-28 리뷰). 다른 저장값(최고 기록·누적 사망 기록·설정)은 건드리지 않는다.
export function pruneStaleGhosts(levels: readonly Level[]): void {
  try {
    const keep = new Set(levels.map((level, i) => ghostKey(level, i)));
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX) && !keep.has(key)) stale.push(key);
    }
    for (const key of stale) localStorage.removeItem(key);
  } catch { /* 저장소가 막힘 — 지울 것도 없다 */ }
}

// 고스트 보기 설정 — 기본은 꺼짐(오너 결정). 일시정지 창에서 켜고 끈다.
export function loadGhostEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
}
export function saveGhostEnabled(enabled: boolean): void {
  try { localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0'); } catch { /* 저장 실패 시 이번 세션에만 */ }
}
