// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameController, mergeBest, type HudSnapshot } from '../../../src/game/core/GameController';
import { World } from '../../../src/game/world/World';
import { SoundPlayer } from '../../../src/game/audio/SoundPlayer';

describe('mergeBest', () => {
  it('takes the first clear as the best record', () => {
    expect(mergeBest(null, { time: 20, deaths: 3 })).toEqual({ best: { time: 20, deaths: 3 }, improved: true });
  });

  it('improves time and fewest deaths independently, since they can come from different runs', () => {
    const best = { time: 20, deaths: 3 };
    expect(mergeBest(best, { time: 15, deaths: 5 })).toEqual({ best: { time: 15, deaths: 3 }, improved: true });
    expect(mergeBest(best, { time: 25, deaths: 1 })).toEqual({ best: { time: 20, deaths: 1 }, improved: true });
  });

  it('reports no improvement when the run ties or is worse on both', () => {
    expect(mergeBest({ time: 20, deaths: 3 }, { time: 20, deaths: 3 })).toEqual({ best: { time: 20, deaths: 3 }, improved: false });
    expect(mergeBest({ time: 20, deaths: 3 }, { time: 30, deaths: 4 })).toEqual({ best: { time: 20, deaths: 3 }, improved: false });
  });
});

describe('GameController best record', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

  // RAF를 수동으로 실행해 고정 스텝 하나를 결정적으로 돌린다(GameLoop.test.ts와 같은 방식).
  function startWithManualFrames(): { controller: GameController; snapshots: HudSnapshot[]; fire: (now: number) => void } {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { callbacks.push(cb); return callbacks.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const snapshots: HudSnapshot[] = [];
    const controller = new GameController(document.createElement('canvas'), (s) => snapshots.push(s), (e) => { throw e; });
    controller.start();
    const fire = (now: number): void => { for (const cb of callbacks.splice(0)) cb(now); };
    return { controller, snapshots, fire };
  }

  it('saves the run as the best record on clear and flags it as new; manual restart clears the flag', () => {
    vi.spyOn(World.prototype, 'drainEvents').mockReturnValueOnce(['clear']);
    const { controller, snapshots, fire } = startWithManualFrames();
    fire(0);
    fire(1000 / 60); // 고정 스텝 1회 → drainEvents가 'clear'를 돌려준다
    const last = snapshots[snapshots.length - 1];
    expect(last.best).toEqual({ time: 0, deaths: 0 });
    expect(last.newRecord).toBe(true);
    expect(JSON.parse(localStorage.getItem('trap-runner:best') ?? 'null')).toEqual({ time: 0, deaths: 0 });
    controller.restart();
    expect(snapshots[snapshots.length - 1].newRecord).toBe(false);
    controller.dispose();
  });

  it('does not overwrite a better stored record', () => {
    localStorage.setItem('trap-runner:best', JSON.stringify({ time: 0, deaths: 0 }));
    vi.spyOn(World.prototype, 'drainEvents').mockReturnValueOnce(['clear']);
    vi.spyOn(World.prototype, 'snapshot').mockReturnValue({
      x: 0, y: 0, grounded: true, deaths: 4, cleared: true, checkpoint: false, time: 30, runDeaths: 4,
    });
    const { controller, snapshots, fire } = startWithManualFrames();
    fire(0);
    fire(1000 / 60);
    expect(snapshots[snapshots.length - 1].newRecord).toBe(false);
    expect(JSON.parse(localStorage.getItem('trap-runner:best') ?? 'null')).toEqual({ time: 0, deaths: 0 });
    controller.dispose();
  });

  it('does not overwrite a better record saved by another tab after this one started', () => {
    // 코덱스 리뷰: 시작 시 한 번 읽은 기록만 비교해서, 먼저 열어 둔 B 탭이 A 탭의 더 좋은 기록
    // (10초·0회)을 모른 채 20초·3회로 덮어쓰고 NEW RECORD!를 띄웠다.
    const frames = new Map<number, FrameRequestCallback>();
    let nextId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++nextId, cb); return nextId; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
    const fire = (now: number): void => { const pending = [...frames.values()]; frames.clear(); for (const cb of pending) cb(now); };
    let run = { time: 10, runDeaths: 0 };
    vi.spyOn(World.prototype, 'snapshot').mockImplementation(() => ({
      x: 0, y: 0, grounded: true, deaths: run.runDeaths, cleared: true, checkpoint: false, ...run,
    }));
    const drain = vi.spyOn(World.prototype, 'drainEvents');
    const snapshotsB: HudSnapshot[] = [];
    const tabB = new GameController(document.createElement('canvas'), (s) => snapshotsB.push(s), (e) => { throw e; }); // 기록 없음으로 시작

    const tabA = new GameController(document.createElement('canvas'), () => {}, (e) => { throw e; });
    drain.mockReturnValueOnce(['clear']);
    tabA.start(); fire(0); fire(1000 / 60);
    tabA.dispose();
    expect(JSON.parse(localStorage.getItem('trap-runner:best') ?? 'null')).toEqual({ time: 10, deaths: 0 });

    run = { time: 20, runDeaths: 3 };
    drain.mockReturnValueOnce(['clear']);
    tabB.start(); fire(2000); fire(2000 + 1000 / 60);
    expect(JSON.parse(localStorage.getItem('trap-runner:best') ?? 'null')).toEqual({ time: 10, deaths: 0 });
    const last = snapshotsB[snapshotsB.length - 1];
    expect(last.newRecord).toBe(false);
    expect(last.best).toEqual({ time: 10, deaths: 0 }); // 다른 탭의 기록이 이 탭 HUD에도 반영된다
    tabB.dispose();
  });
});

describe('GameController tab visibility', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('stops the background music immediately when the tab is hidden, without waiting for another frame', () => {
    // 코덱스 리뷰: 음악 중단이 다음 고정 스텝의 updateMusic 호출에만 의존해서, 숨겨진 탭에서 RAF가
    // 멈추면 이미 예약된 음악이 페이드아웃되지 않고 끝까지 재생됐다.
    vi.stubGlobal('requestAnimationFrame', () => 1); // 프레임을 한 번도 실행하지 않는다
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const updateMusic = vi.spyOn(SoundPlayer.prototype, 'updateMusic');
    const snapshots: HudSnapshot[] = [];
    const controller = new GameController(document.createElement('canvas'), (s) => snapshots.push(s), (e) => { throw e; });
    controller.start();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    try {
      document.dispatchEvent(new Event('visibilitychange'));
      expect(updateMusic).toHaveBeenCalledWith(false);
      expect(snapshots[snapshots.length - 1].paused).toBe(true);
    } finally {
      controller.dispose();
      Reflect.deleteProperty(document, 'hidden'); // 인스턴스에 정의한 값을 지워 프로토타입의 기본값으로 되돌린다
    }
  });
});

