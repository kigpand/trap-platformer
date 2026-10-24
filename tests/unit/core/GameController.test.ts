// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameController, mergeBest, type HudSnapshot } from '../../../src/game/core/GameController';
import { World } from '../../../src/game/world/World';

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
});

