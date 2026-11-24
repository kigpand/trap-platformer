// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearDeathLogs, deathLogKey, EMPTY_DEATH_LOG, levelHash, loadDeathLog, MAX_LOGGED_MARKS, parseDeathLog, recordDeath } from '../../../src/game/core/deathLogStore';
import { LEVELS } from '../../../src/game/world/level';
import { testLevel } from '../world/fixtures';

// 누적 사망 기록(docs/game-design.md "기록"): 레벨마다 원인별 사망 수와 자리를 localStorage에 쌓는다.
const level = testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }] });

describe('death log store', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

  it('adds a death by cause and by spot, merging nearby spots with the run-mark rule, and keeps it across loads', () => {
    let log = recordDeath(level, 0, EMPTY_DEATH_LOG, { x: 300, y: 500, kind: 'hiddenBlock' });
    log = recordDeath(level, 0, log, { x: 310, y: 500, kind: 'hiddenBlock' }); // 16px 안 — 같은 자리
    log = recordDeath(level, 0, log, { x: 900, y: 500, kind: 'fall' });
    expect(log).toEqual({ kinds: { hiddenBlock: 2, fall: 1 }, marks: [{ x: 300, y: 500, count: 2 }, { x: 900, y: 500, count: 1 }] });
    expect(loadDeathLog(level, 0)).toEqual(log);
    expect(loadDeathLog(level, 1)).toEqual(EMPTY_DEATH_LOG); // 레벨마다 따로
  });

  it('adds to what another tab saved instead of overwriting it', () => {
    recordDeath(level, 0, EMPTY_DEATH_LOG, { x: 300, y: 500, kind: 'arrow' }); // 다른 탭이 저장
    const log = recordDeath(level, 0, EMPTY_DEATH_LOG, { x: 300, y: 500, kind: 'arrow' }); // 이 탭은 시작할 때 비어 있었음
    expect(log.kinds.arrow).toBe(2);
    expect(log.marks).toEqual([{ x: 300, y: 500, count: 2 }]);
  });

  it('starts afresh when the level layout changes, since old spots would point at moved traps', () => {
    const moved = testLevel({ solids: [{ x: 0, y: 500, width: 1990, height: 120 }] });
    expect(levelHash(level)).toBe(levelHash(testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }] })));
    expect(levelHash(moved)).not.toBe(levelHash(level));
    recordDeath(level, 0, EMPTY_DEATH_LOG, { x: 300, y: 500, kind: 'fall' });
    expect(loadDeathLog(moved, 0)).toEqual(EMPTY_DEATH_LOG);
    expect(new Set(LEVELS.map(levelHash)).size).toBe(LEVELS.length);
  });

  it('stops adding new spots at the cap but keeps counting causes and existing spots', () => {
    let log = EMPTY_DEATH_LOG;
    for (let i = 0; i < MAX_LOGGED_MARKS; i++) log = recordDeath(level, 0, log, { x: i * 40, y: 500, kind: 'fall' });
    log = recordDeath(level, 0, log, { x: 99_999, y: 500, kind: 'fall' });
    expect(log.marks).toHaveLength(MAX_LOGGED_MARKS); // 새 자리는 더하지 않는다(저장하기 전에)
    expect(parseDeathLog(localStorage.getItem(deathLogKey(level, 0))).marks.some((m) => m.x === 99_999)).toBe(false);
    log = recordDeath(level, 0, log, { x: 0, y: 500, kind: 'fall' });
    expect(log.marks).toHaveLength(MAX_LOGGED_MARKS);
    expect(log.marks[0].count).toBe(2);
    expect(log.kinds.fall).toBe(MAX_LOGGED_MARKS + 2);
  });

  it('drops broken values, unknown causes and bad marks', () => {
    expect(parseDeathLog(null)).toEqual(EMPTY_DEATH_LOG);
    expect(parseDeathLog('{not json')).toEqual(EMPTY_DEATH_LOG);
    expect(parseDeathLog('[1,2]')).toEqual(EMPTY_DEATH_LOG);
    const raw = JSON.stringify({
      kinds: { arrow: 3, notATrap: 5, fall: -1, ice: 1.5, toString: 2 },
      marks: [{ x: 10, y: 500, count: 2 }, { x: 'a', y: 500, count: 1 }, { x: 20, y: 500, count: 0 }, null],
    });
    expect(parseDeathLog(raw)).toEqual({ kinds: { arrow: 3 }, marks: [{ x: 10, y: 500, count: 2 }] });
  });

  it('clears every level\'s log, old layouts included, and leaves other keys alone', () => {
    recordDeath(level, 0, EMPTY_DEATH_LOG, { x: 300, y: 500, kind: 'fall' });
    localStorage.setItem('trap-runner:deaths:v1:2:deadbeef', '{}'); // 배치가 바뀌어 더 읽지 않는 예전 키
    localStorage.setItem('trap-runner:best:v2:1', JSON.stringify({ time: 10, deaths: 0 }));
    clearDeathLogs();
    expect(localStorage.getItem(deathLogKey(level, 0))).toBeNull();
    expect(localStorage.getItem('trap-runner:deaths:v1:2:deadbeef')).toBeNull();
    expect(localStorage.getItem('trap-runner:best:v2:1')).not.toBeNull();
  });

  it('still counts in this session when localStorage is blocked', () => {
    const blocked = (): never => { throw new DOMException('blocked', 'SecurityError'); };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked, key: blocked, get length(): number { return blocked(); }, clear: () => {} });
    expect(loadDeathLog(level, 0)).toEqual(EMPTY_DEATH_LOG);
    const log = recordDeath(level, 0, { kinds: { fall: 1 }, marks: [] }, { x: 300, y: 500, kind: 'fall' });
    expect(log.kinds.fall).toBe(2);
    expect(() => clearDeathLogs()).not.toThrow();
  });
});
