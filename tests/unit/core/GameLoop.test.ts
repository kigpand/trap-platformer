import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameLoop } from '../../../src/game/core/GameLoop';

// GameLoop은 전역 requestAnimationFrame/cancelAnimationFrame에 의존한다. 실제 RAF 대신
// 콜백을 보관했다가 테스트가 원하는 시각(now)에 수동으로 실행하는 스텁으로 교체해,
// 결정적으로 프레임 타이밍을 제어한다.
function stubRaf() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  const raf = vi.fn((cb: FrameRequestCallback) => { nextId += 1; callbacks.set(nextId, cb); return nextId; });
  const caf = vi.fn((handle: number) => { callbacks.delete(handle); });
  const fire = (now: number): void => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const cb of pending) cb(now);
  };
  return { raf, caf, fire };
}

describe('GameLoop', () => {
  let originalRaf: typeof requestAnimationFrame;
  let originalCaf: typeof cancelAnimationFrame;
  beforeEach(() => {
    originalRaf = globalThis.requestAnimationFrame;
    originalCaf = globalThis.cancelAnimationFrame;
  });
  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCaf;
  });

  it('runs one fixed 1/60s physics step per 1/60s of accumulated real time', () => {
    const stub = stubRaf();
    globalThis.requestAnimationFrame = stub.raf as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = stub.caf as typeof cancelAnimationFrame;
    const steps: number[] = [];
    const loop = new GameLoop((dt) => steps.push(dt), () => {}, () => {});
    loop.start();
    stub.fire(0); // 첫 프레임은 기준 시각(previous)만 세운다
    stub.fire((1000 / 60) * 3); // 정확히 3스텝 분량의 실제 시간 경과
    expect(steps).toHaveLength(3);
    expect(steps[0]).toBeCloseTo(1 / 60);
  });

  it('caps physics steps at MAX_STEPS_PER_FRAME when a single frame delta is huge (e.g. a slow frame or dev-tools pause)', () => {
    const stub = stubRaf();
    globalThis.requestAnimationFrame = stub.raf as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = stub.caf as typeof cancelAnimationFrame;
    let stepCount = 0;
    const loop = new GameLoop(() => { stepCount++; }, () => {}, () => {});
    loop.start();
    stub.fire(0);
    stub.fire(5000); // 5초가 한 프레임 사이에 흘렀다고 보고 — 보정 없이 따라잡으면 수백 스텝이 된다
    expect(stepCount).toBeLessThanOrEqual(6);
  });

  it('resets the accumulator instead of carrying leftover time once the step cap is hit, so a backlog from a huge gap does not bleed into later frames', () => {
    const stub = stubRaf();
    globalThis.requestAnimationFrame = stub.raf as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = stub.caf as typeof cancelAnimationFrame;
    let stepCount = 0;
    const loop = new GameLoop(() => { stepCount++; }, () => {}, () => {});
    loop.start();
    stub.fire(0);
    stub.fire(8); // 8ms(한 스텝 미만) — 누적기에 ~0.008s가 정상적으로 남는다
    expect(stepCount).toBe(0);
    stub.fire(8 + 5000); // 거대한 델타: MAX_FRAME_DELTA로 잘려 6스텝 상한에 도달
    expect(stepCount).toBe(6);
    stepCount = 0;
    stub.fire(8 + 5000 + 10); // 그 직후의 평범한 10ms 프레임(그 자체로는 한 스텝(~16.7ms)에 못 미친다)
    // 상한에 걸렸을 때 누적기가 리셋되지 않고 이전 ~0.008s가 그대로 남아 있었다면
    // 0.008 + 0.01 = 0.018s로 한 스텝 분량(1/60s)을 넘어 여기서 스텝이 한 번 더 발생했을 것이다.
    expect(stepCount).toBe(0);
  });

  it('reports the number of physics steps taken that frame via render metrics', () => {
    const stub = stubRaf();
    globalThis.requestAnimationFrame = stub.raf as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = stub.caf as typeof cancelAnimationFrame;
    let lastSteps = -1;
    const loop = new GameLoop(() => {}, (metrics) => { lastSteps = metrics.steps; }, () => {});
    loop.start();
    stub.fire(0);
    stub.fire((1000 / 60) * 2);
    expect(lastSteps).toBe(2);
  });

  it('stop() cancels the pending frame and clears timing state so the next start() does not treat the gap as elapsed time', () => {
    const stub = stubRaf();
    globalThis.requestAnimationFrame = stub.raf as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = stub.caf as typeof cancelAnimationFrame;
    let stepCount = 0;
    const loop = new GameLoop(() => { stepCount++; }, () => {}, () => {});
    loop.start();
    stub.fire(0);
    loop.stop();
    expect(stub.caf).toHaveBeenCalled();
    loop.start();
    stub.fire(10000); // 재시작 후 첫 프레임은 임의의 later now 값이어도 그냥 기준 시각만 다시 세운다
    expect(stepCount).toBe(0);
  });

  it('stops the loop and reports the error instead of silently freezing when a step throws', () => {
    // 예외가 나면 다음 RAF가 예약되지 않아 게임이 아무 안내 없이 멈춘 채 남았다.
    const stub = stubRaf();
    globalThis.requestAnimationFrame = stub.raf as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = stub.caf as typeof cancelAnimationFrame;
    const boom = new Error('boom');
    const errors: unknown[] = [];
    let renders = 0;
    const loop = new GameLoop(() => { throw boom; }, () => { renders++; }, (error) => errors.push(error));
    loop.start();
    stub.fire(0);
    const rafCallsBefore = stub.raf.mock.calls.length;
    stub.fire(1000 / 60);
    expect(errors).toEqual([boom]);
    expect(renders).toBe(1); // 실패한 프레임은 그리지 않는다
    expect(stub.raf.mock.calls.length).toBe(rafCallsBefore); // 실패 후 다음 프레임을 예약하지 않는다
    loop.start(); // stop()으로 정리됐으므로 다시 시작할 수 있다
    expect(stub.raf.mock.calls.length).toBe(rafCallsBefore + 1);
  });
});
