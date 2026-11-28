// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodePose, ghostKey, ghostPoseAt, loadGhost, loadGhostEnabled, MAX_GHOST_FRAMES, parseGhost, pruneStaleGhosts, saveGhostEnabled, saveGhostIfFaster, type Ghost } from '../../../src/game/core/ghostStore';
import { testLevel } from '../world/fixtures';

const level = testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }] });
// 1/30초마다 한 프레임: x 100 → 110 → 120(오른쪽, 땅, 움직임), 그다음 체크포인트로 순간이동(x 50).
const frames = [...encodePose({ x: 100, y: 468, facing: 1, grounded: true, vx: 210 }), ...encodePose({ x: 110, y: 468, facing: 1, grounded: true, vx: 210 }),
  ...encodePose({ x: 120, y: 460, facing: -1, grounded: false, vx: -210 }), ...encodePose({ x: 50, y: 468, facing: 1, grounded: true, vx: 0 })];
const ghost: Ghost = { time: 10, frames };

describe('ghost store', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

  it('packs facing, airborne and moving into one flag per frame', () => {
    expect(encodePose({ x: 10.4, y: 20.6, facing: 1, grounded: true, vx: 0 })).toEqual([10, 21, 0]);
    expect(encodePose({ x: 0, y: 0, facing: -1, grounded: false, vx: 5 })).toEqual([0, 0, 1 | 2 | 4]);
  });

  it('gives the pose at a run time, in between frames linearly, without bridging a respawn jump, and nothing after the run', () => {
    expect(ghostPoseAt(ghost, 0)).toEqual({ x: 100, y: 468, facing: 1, airborne: false, moving: true });
    expect(ghostPoseAt(ghost, 1 / 60)?.x).toBeCloseTo(105); // 두 프레임 사이 절반
    expect(ghostPoseAt(ghost, 2 / 30)).toMatchObject({ x: 120, facing: -1, airborne: true, moving: true });
    expect(ghostPoseAt(ghost, 2 / 30 + 1 / 60)?.x).toBe(120); // 다음 프레임은 순간이동(70px) — 잇지 않는다
    expect(ghostPoseAt(ghost, 3 / 30)).toMatchObject({ x: 50, moving: false });
    expect(ghostPoseAt(ghost, 4 / 30)).toBeNull();
  });

  it('saves only a faster run, so a slower clear or a faster ghost from another tab is kept', () => {
    expect(saveGhostIfFaster(level, 0, ghost)).toEqual(ghost);
    expect(loadGhost(level, 0)).toEqual(ghost);
    const slower = { time: 12, frames: frames.slice(0, 3) };
    expect(saveGhostIfFaster(level, 0, slower)).toEqual(ghost);
    const faster = { time: 8, frames: frames.slice(0, 6) };
    expect(saveGhostIfFaster(level, 0, faster)).toEqual(faster);
    expect(loadGhost(level, 0)).toEqual(faster);
    expect(loadGhost(level, 1)).toBeNull(); // 레벨마다 따로
  });

  it('starts afresh when the level layout changes', () => {
    saveGhostIfFaster(level, 0, ghost);
    const moved = testLevel({ solids: [{ x: 0, y: 500, width: 1990, height: 120 }] });
    expect(ghostKey(moved, 0)).not.toBe(ghostKey(level, 0));
    expect(loadGhost(moved, 0)).toBeNull();
  });

  it('treats broken values as no ghost', () => {
    expect(parseGhost(null)).toBeNull();
    expect(parseGhost('nope')).toBeNull();
    expect(parseGhost(JSON.stringify({ time: 1, frames: [1, 2] }))).toBeNull(); // 세 개씩이 아님
    expect(parseGhost(JSON.stringify({ time: -1, frames: [1, 2, 3] }))).toBeNull();
    expect(parseGhost(JSON.stringify({ time: 1, frames: [1, 'x', 3] }))).toBeNull();
    expect(parseGhost(JSON.stringify({ time: 1, frames: [] }))).toBeNull();
    expect(parseGhost(JSON.stringify({ time: 1, frames: new Array((MAX_GHOST_FRAMES + 1) * 3).fill(0) }))).toBeNull();
    expect(parseGhost(JSON.stringify({ time: 1, frames: [1, 2, 3] }))).toEqual({ time: 1, frames: [1, 2, 3] });
  });

  it('keeps the ghost view off by default and remembers the choice', () => {
    expect(loadGhostEnabled()).toBe(false);
    saveGhostEnabled(true);
    expect(loadGhostEnabled()).toBe(true);
    saveGhostEnabled(false);
    expect(loadGhostEnabled()).toBe(false);
  });

  it('drops ghosts of old layouts and missing levels, keeping the current ones and every other saved value', () => {
    const other = testLevel({ solids: [{ x: 0, y: 500, width: 1500, height: 120 }] });
    saveGhostIfFaster(level, 0, ghost);
    saveGhostIfFaster(other, 1, ghost);
    localStorage.setItem('trap-runner:ghost:v1:1:deadbeef', '{}'); // 레벨 1의 예전 배치
    localStorage.setItem('trap-runner:ghost:v1:9:cafebabe', '{}'); // 없어진 레벨
    localStorage.setItem('trap-runner:best:v2:1', '{"time":1,"deaths":0}');
    localStorage.setItem('trap-runner:ghost-enabled', '1');
    pruneStaleGhosts([level, other]);
    expect(loadGhost(level, 0)).toEqual(ghost);
    expect(loadGhost(other, 1)).toEqual(ghost);
    expect(localStorage.getItem('trap-runner:ghost:v1:1:deadbeef')).toBeNull();
    expect(localStorage.getItem('trap-runner:ghost:v1:9:cafebabe')).toBeNull();
    expect(localStorage.getItem('trap-runner:best:v2:1')).not.toBeNull();
    expect(localStorage.getItem('trap-runner:ghost-enabled')).toBe('1'); // 설정 키는 접두어가 달라 남는다
  });

  it('keeps working without storage', () => {
    const blocked = (): never => { throw new DOMException('blocked', 'SecurityError'); };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked, key: blocked, get length(): number { return blocked(); }, clear: () => {} });
    expect(loadGhost(level, 0)).toBeNull();
    expect(saveGhostIfFaster(level, 0, ghost)).toEqual(ghost);
    expect(loadGhostEnabled()).toBe(false);
    expect(() => saveGhostEnabled(true)).not.toThrow();
    expect(() => pruneStaleGhosts([level])).not.toThrow();
  });
});
