// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HudSnapshot } from '../../src/game/core/GameController';

// App의 스크린 리더 알림만 본다. 게임 캔버스는 스냅샷을 직접 넣을 수 있는 대역으로 바꾼다.
let push: (s: HudSnapshot) => void = () => {};
vi.mock('../../src/components/GameCanvas', () => ({
  GameCanvas: function FakeCanvas({ onSnapshot }: { onSnapshot: (s: HudSnapshot) => void }) {
    push = onSnapshot;
    return null;
  },
}));
const { default: App } = await import('../../src/App');

const base: HudSnapshot = {
  x: 0, y: 0, grounded: true, deaths: 0, cleared: false, checkpoint: false, time: 5, runDeaths: 0, deathKind: null,
  paused: false, muted: false, volume: 0.8, level: 1, levelCount: 3, best: null, bests: [null, null, null], newRecord: false,
};

describe('App announcements', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('announces when a clear screen goes away without a death (fake clear #14), and a later death normally', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(App)); });
    const status = (): string => container.querySelector('[role="status"]')?.textContent ?? '';
    await act(async () => { push({ ...base, cleared: true, newRecord: true }); });
    expect(status()).toContain('레벨 1 클리어!');
    await act(async () => { push({ ...base, x: 200 }); });
    expect(status()).toBe('다시 진행 중');
    await act(async () => { push({ ...base, deaths: 1, runDeaths: 1, deathKind: 'fakeClear' }); });
    expect(status()).toContain('사망 1번째');
    expect(status()).toContain('벌써 끝난 줄 알았지?');
    await act(async () => { root.unmount(); });
  });
});
