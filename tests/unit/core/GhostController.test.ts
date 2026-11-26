// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameController, type HudSnapshot } from '../../../src/game/core/GameController';
import { ghostKey, parseGhost } from '../../../src/game/core/ghostStore';
import { CanvasRenderer, type GhostPose } from '../../../src/game/rendering/CanvasRenderer';
import { testLevel } from '../world/fixtures';

// 고스트(docs/game-design.md "기록"): 진짜 클리어한 런이 저장된 고스트보다 빠르면 저장하고, 켜 두면 다음 런에서 같은 런 시간에 맞춰 보여 준다.
// 스폰에서 오른쪽으로 약 1초 달리면 목표에 닿는 시험용 레벨 — 흉내 내지 않고 실제로 클리어한다.
const level = testLevel({ spawn: { x: 65, y: 468 }, solids: [{ x: 0, y: 500, width: 2000, height: 120 }], goal: { x: 300, y: 440, width: 40, height: 60 } });
const levels = [level, testLevel({ solids: [{ x: 0, y: 500, width: 2000, height: 120 }] })];

describe('GameController ghost', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

  function start() {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { callbacks.push(cb); return callbacks.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    let ghost: GhostPose | null = null;
    vi.spyOn(CanvasRenderer.prototype, 'render').mockImplementation(function (this: CanvasRenderer) { ghost = this.ghost; });
    const snapshots: HudSnapshot[] = [];
    const controller = new GameController(document.createElement('canvas'), (s) => snapshots.push(s), (e) => { throw e; }, levels);
    controller.start();
    let now = 0;
    for (const cb of callbacks.splice(0)) cb(now);
    const step = (n = 1): void => { for (let i = 0; i < n; i++) { now += 1000 / 60; for (const cb of callbacks.splice(0)) cb(now); } };
    const key = (code: string, down: boolean): void => { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code })); };
    const runToGoal = (delaySteps = 0): void => {
      step(delaySteps);
      key('ArrowRight', true);
      for (let i = 0; i < 300 && !snapshots[snapshots.length - 1].cleared; i++) step();
      key('ArrowRight', false);
      expect(snapshots[snapshots.length - 1].cleared).toBe(true);
    };
    return { controller, step, runToGoal, last: () => snapshots[snapshots.length - 1], ghost: () => ghost };
  }
  const stored = () => parseGhost(localStorage.getItem(ghostKey(level, 0)));

  it('saves a real clear as the level ghost, frames every 2 steps of run time', () => {
    const { controller, runToGoal, last } = start();
    expect(last().ghostAvailable).toBe(false);
    runToGoal();
    const ghost = stored();
    expect(ghost?.time).toBe(last().time);
    expect(ghost?.frames.length).toBe(3 * (Math.floor(Math.round(last().time * 60) / 2) + 1));
    expect(ghost?.frames[0]).toBeLessThan(72); // 스폰(x 65) 바로 다음 스텝에서 시작
    expect(last().ghostAvailable).toBe(true);
    controller.dispose();
  });

  it('shows nothing while the ghost is off (the default), and replays the saved run in step with the run time once on', () => {
    const { controller, step, runToGoal, ghost, last } = start();
    runToGoal();
    controller.restart();
    step(10);
    expect(last().ghostEnabled).toBe(false);
    expect(ghost()).toBeNull();
    controller.toggleGhost();
    expect(localStorage.getItem('trap-runner:ghost-enabled')).toBe('1');
    step(1);
    const t = last().time;
    const pose = ghost();
    expect(pose).not.toBeNull();
    expect(pose?.x).toBeGreaterThan(65); // 저장한 런은 이 시각에 이미 달리고 있었다(이번 런은 서 있음)
    expect(pose?.moving).toBe(true);
    expect(t).toBeGreaterThan(0);
    controller.toggleGhost();
    step(1);
    expect(ghost()).toBeNull();
    controller.dispose();
  });

  it('keeps the faster ghost when a later clear is slower, and replaces it when faster', () => {
    const a = start();
    a.runToGoal(30); // 0.5초 늦게 출발
    const slow = stored();
    a.controller.dispose();
    const b = start();
    b.runToGoal(60); // 더 늦게 — 바꾸지 않는다
    expect(stored()).toEqual(slow);
    b.controller.restart();
    b.runToGoal(0); // 더 빠르게 — 바꾼다
    expect(stored()?.time).toBeLessThan(slow?.time ?? 0);
    b.controller.dispose();
  });

  it('starts recording afresh on a manual restart', () => {
    const { controller, step, runToGoal } = start();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
    step(40); // 왼쪽 끝으로 달린다 — 이번 런이 아니다
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }));
    controller.restart();
    runToGoal();
    const frames = stored()?.frames ?? [];
    for (let k = 1; k <= 15; k++) expect(frames[k * 3], `frame ${k}`).toBeGreaterThan(65); // 재시작 뒤 오른쪽으로 달린 런만 담았다
    expect(frames[10 * 3 + 2] & 1).toBe(0); // 오른쪽을 본다(왼쪽으로 달린 프레임이 아님)
    controller.dispose();
  });
});
