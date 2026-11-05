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
  x: 0, y: 0, grounded: true, deaths: 0, cleared: false, checkpoint: false, time: 5, runDeaths: 0, deathKind: null, runDeathsByKind: {},
  paused: false, muted: false, volume: 0.8, level: 1, levelCount: 3, best: null, bests: [null, null, null], newRecord: false, levelDeaths: [null, null, null],
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

describe('App death stats on the clear screen', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('lists this run\'s deaths by cause, most first, only while cleared, and names the top one in the announcement', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(App)); });
    const stats = (): Element | null => container.querySelector('[aria-label="이번 런에서 당한 함정"]');
    const byKind = { shadow: 1, hazard: 4, fall: 2 };
    await act(async () => { push({ ...base, deaths: 7, runDeaths: 7, runDeathsByKind: byKind }); });
    expect(stats()).toBeNull(); // 클리어 전에는 보이지 않는다
    await act(async () => { push({ ...base, deaths: 7, runDeaths: 7, runDeathsByKind: byKind, cleared: true }); });
    expect([...stats()!.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['가짜 안전지대 ×4', '그냥 떨어짐 ×2', '따라 하는 그림자 ×1']);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('가장 많이 당한 함정: 가짜 안전지대 4회.');
    await act(async () => { root.unmount(); });
  });

  it('says so when the run had no deaths', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(App)); });
    await act(async () => { push({ ...base, cleared: true }); });
    expect(container.querySelector('[aria-label="이번 런에서 당한 함정"]')?.textContent).toContain('한 번도 안 당했어요!');
    expect(container.querySelector('[role="status"]')?.textContent).not.toContain('가장 많이 당한 함정');
    await act(async () => { root.unmount(); });
  });

  it('shows each level\'s top trap of this play-through on the completion screen', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(App)); });
    await act(async () => {
      push({ ...base, level: 3, cleared: true, levelDeaths: [{ hazard: 2, fall: 1 }, {}, { shadow: 1 }] });
    });
    const items = [...container.querySelectorAll('[aria-label="모든 레벨 클리어"] li')].map((li) => li.textContent);
    expect(items[0]).toContain('가장 많이 당한 함정 가짜 안전지대 ×2');
    expect(items[1]).toContain('당한 함정 없음');
    expect(items[2]).toContain('가장 많이 당한 함정 따라 하는 그림자 ×1');
    await act(async () => { root.unmount(); });
  });
});
