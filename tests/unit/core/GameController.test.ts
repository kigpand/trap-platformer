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


describe('GameController level progression', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

  // RAF를 수동으로 돌리고, "클리어"는 World.update를 대신해 cleared를 세우고 'clear' 이벤트를 한 번 내보내 흉내 낸다
  // (실제 레벨 완주는 World 테스트의 자동 플레이가 검증한다).
  function setup() {
    let frame = 0;
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { callbacks.push(cb); return callbacks.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const snapshots: HudSnapshot[] = [];
    const controller = new GameController(document.createElement('canvas'), (s) => snapshots.push(s), (e) => { throw e; });
    controller.start();
    // 1000/60ms씩 넘기면 부동소수 오차로 고정 스텝 하나에 못 미칠 수 있어, 20ms씩 넘겨 매 프레임 최소 한 스텝이 돌게 한다.
    const step = (): void => { frame++; for (const cb of callbacks.splice(0)) cb(frame * 20); };
    step(); // 첫 프레임은 기준 시각만 세운다
    const clearCurrentLevel = (): void => {
      const update = vi.spyOn(World.prototype, 'update').mockImplementationOnce(function (this: World) { this.cleared = true; });
      vi.spyOn(World.prototype, 'drainEvents').mockReturnValueOnce(['clear']);
      step();
      update.mockRestore();
    };
    const last = (): HudSnapshot => snapshots[snapshots.length - 1];
    return { controller, step, clearCurrentLevel, last };
  }

  it('starts at level 1 of all levels and ignores "next level" before the level is cleared', () => {
    const { controller, last } = setup();
    expect(last().level).toBe(1);
    expect(last().levelCount).toBeGreaterThanOrEqual(2);
    controller.nextLevel();
    expect(last().level).toBe(1);
    controller.dispose();
  });

  it('moves to the next level after a clear with a fresh run, and saves each level\'s record under its own key', () => {
    const { controller, clearCurrentLevel, last } = setup();
    clearCurrentLevel();
    expect(last().cleared).toBe(true);
    expect(localStorage.getItem('trap-runner:best')).not.toBeNull(); // 레벨 1은 기존 키
    controller.nextLevel();
    expect(last().level).toBe(2);
    expect(last().cleared).toBe(false);
    expect(last().time).toBe(0);
    expect(last().newRecord).toBe(false);
    expect(last().best).toBeNull(); // 레벨 2는 아직 기록 없음
    clearCurrentLevel();
    expect(localStorage.getItem('trap-runner:best:2')).not.toBeNull();
    expect(last().bests.slice(0, 2).every((b) => b !== null)).toBe(true); // 클리어한 레벨 1·2의 기록이 완료 화면용 목록에 있다
    controller.dispose();
  });

  it('goes back to level 1 after the last level is cleared', () => {
    const { controller, clearCurrentLevel, last } = setup();
    for (let i = 0; i < last().levelCount; i++) { clearCurrentLevel(); controller.nextLevel(); }
    expect(last().level).toBe(1);
    controller.dispose();
  });

  it('carries over the record saved before levels existed as the level 1 record', () => {
    localStorage.setItem('trap-runner:best', JSON.stringify({ time: 12.3, deaths: 2 }));
    const { controller, last } = setup();
    expect(last().bests[0]).toEqual({ time: 12.3, deaths: 2 });
    expect(last().best).toEqual({ time: 12.3, deaths: 2 });
    controller.dispose();
  });

  it('does not carry a pause over into the next level', () => {
    // 코덱스 리뷰: 클리어 후 일시정지한 상태에서 다음 레벨로 넘어가면 새 레벨이 정지된 채 시작했다.
    const { controller, clearCurrentLevel, last } = setup();
    clearCurrentLevel();
    controller.togglePause();
    expect(last().paused).toBe(true);
    controller.nextLevel();
    expect(last().level).toBe(2);
    expect(last().paused).toBe(false);
    controller.dispose();
  });

  it('keeps the pause when "next level" is ignored because the level is not cleared yet', () => {
    const { controller, last } = setup();
    controller.togglePause();
    controller.nextLevel();
    expect(last().level).toBe(1);
    expect(last().paused).toBe(true);
    controller.dispose();
  });

  it('advances with the N key once the level is cleared', () => {
    const { controller, step, clearCurrentLevel, last } = setup();
    clearCurrentLevel();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' }));
    step();
    expect(last().level).toBe(2);
    controller.dispose();
  });
});
