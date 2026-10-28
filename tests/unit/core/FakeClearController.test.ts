// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameController, type HudSnapshot } from '../../../src/game/core/GameController';
import { SoundPlayer } from '../../../src/game/audio/SoundPlayer';

// #14 가짜 클리어가 컨트롤러 화면 상태까지 진짜 클리어를 흉내 내는지 확인한다. 실제 레벨에는 아직 배치하지 않았으므로
// (약올리는 함정 릴리스 5번) 레벨 목록을 가짜 깃발 하나만 둔 시험용 레벨로 바꾼다. 스폰이 깃발과 겹쳐 첫 스텝에 닿는다.
vi.mock('../../../src/game/world/level', async () => {
  const { testLevel } = await import('../world/fixtures');
  const level = testLevel({
    spawn: { x: 940, y: 468 },
    solids: [{ x: 0, y: 500, width: 800, height: 120 }, { x: 1100, y: 500, width: 900, height: 120 }],
    goal: { x: 1900, y: 440, width: 40, height: 60 },
    fakeGoals: [{ flag: { x: 940, y: 440, width: 40, height: 60 }, floor: [{ x: 800, y: 500, width: 300, height: 120 }] }],
  });
  return { LEVEL_1: level, LEVELS: [level, testLevel({})] };
});

describe('GameController fake clear', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

  function start(): { controller: GameController; last: () => HudSnapshot; step: (n?: number) => void } {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { callbacks.push(cb); return callbacks.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const snapshots: HudSnapshot[] = [];
    const controller = new GameController(document.createElement('canvas'), (s) => snapshots.push(s), (e) => { throw e; });
    controller.start();
    let now = 0;
    for (const cb of callbacks.splice(0)) cb(now);
    const step = (n = 1): void => { for (let i = 0; i < n; i++) { now += 1000 / 60; for (const cb of callbacks.splice(0)) cb(now); } };
    return { controller, last: () => snapshots[snapshots.length - 1], step };
  }

  it('shows the clear screen with the would-be record and clear sound, but saves nothing', () => {
    const play = vi.spyOn(SoundPlayer.prototype, 'play');
    const { controller, last, step } = start();
    step();
    expect(last().cleared).toBe(true);
    expect(last().newRecord).toBe(true); // 기록이 없으니 진짜였다면 NEW RECORD!
    expect(last().best).toEqual({ time: last().time, deaths: 0 });
    expect(play).toHaveBeenCalledWith('clear');
    expect(localStorage.getItem('trap-runner:best:v2:1')).toBeNull();
    controller.dispose();
  });

  it('drops the floor instead of advancing when N is pressed, and the fall is a fake-clear death', () => {
    const { controller, last, step } = start();
    step();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' }));
    step();
    expect(last().level).toBe(1);
    expect(last().cleared).toBe(false);
    expect(last().newRecord).toBe(false);
    expect(last().best).toBeNull();
    for (let i = 0; i < 200 && last().deaths === 0; i++) step();
    expect(last().deaths).toBe(1);
    expect(last().deathKind).toBe('fakeClear');
    expect(last().level).toBe(1);
    expect(localStorage.getItem('trap-runner:best:v2:1')).toBeNull();
    controller.dispose();
  });

  it('does the same from the next-level button, and unpauses like a real advance', () => {
    const { controller, last, step } = start();
    step();
    controller.togglePause();
    expect(last().paused).toBe(true);
    controller.nextLevel();
    expect(last().paused).toBe(false);
    expect(last().cleared).toBe(false);
    expect(last().level).toBe(1);
    controller.dispose();
  });
});
