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
  debugPlayer: null, debugDeaths: null, deaths: 0, cleared: false, checkpoint: false, time: 5, runDeaths: 0, deathKind: null, runDeathsByKind: {},
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
    await act(async () => { push({ ...base, time: 6 }); });
    expect(status()).toBe('다시 진행 중');
    await act(async () => { push({ ...base, deaths: 1, runDeaths: 1, deathKind: 'fakeClear' }); });
    expect(status()).toContain('사망 1번째');
    expect(status()).toContain('벌써 끝난 줄 알았지?');
    await act(async () => { root.unmount(); });
  });

  // 클리어 뒤에도 플레이어는 움직일 수 있어 스냅샷이 계속 온다. 일시정지·재개 알림 뒤의 이동이 클리어 알림을 되살려 다시 읽히면 안 된다.
  it('does not repeat the clear announcement when the player moves after pausing and resuming on the clear screen', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(App)); });
    const status = (): string => container.querySelector('[role="status"]')?.textContent ?? '';
    // World.snapshot()처럼 스냅샷마다 runDeathsByKind를 새 객체로 만든다.
    const cleared = (extra: Partial<HudSnapshot> = {}): HudSnapshot => ({ ...base, cleared: true, runDeathsByKind: {}, ...extra });
    await act(async () => { push(cleared()); });
    expect(status()).toContain('레벨 1 클리어!');
    await act(async () => { push(cleared({ paused: true })); });
    expect(status()).toContain('일시정지됨');
    await act(async () => { push(cleared()); });
    expect(status()).toBe('게임 재개');
    await act(async () => { push(cleared({ debugPlayer: { x: 40, y: 0, grounded: true } })); }); // B를 켜 두면 이동만으로도 스냅샷이 새로 온다
    expect(status()).toBe('게임 재개');
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

describe('App debug HUD', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('shows POSITION and GROUNDED only while the B debug view sends the player state', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(App)); });
    const hud = (): string => container.querySelector('.hud')?.textContent ?? '';
    await act(async () => { push(base); });
    expect(hud()).not.toContain('POSITION');
    expect(hud()).not.toContain('GROUNDED');
    await act(async () => { push({ ...base, debugPlayer: { x: 120, y: 468, grounded: false } }); });
    expect(hud()).toContain('POSITION 120, 468');
    expect(hud()).toContain('GROUNDED NO');
    await act(async () => { root.unmount(); });
  });

  it('shows the cumulative death log panel only while the B debug view sends it, most-hit first', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(App)); });
    const panel = (): Element | null => container.querySelector('[aria-label="누적 사망 기록"]');
    await act(async () => { push(base); });
    expect(panel()).toBeNull();
    await act(async () => { push({ ...base, debugDeaths: { total: 0, kinds: {} } }); });
    expect(panel()?.textContent).toContain('아직 기록이 없어요.');
    await act(async () => { push({ ...base, level: 2, debugDeaths: { total: 7, kinds: { fall: 2, arrow: 5 } } }); });
    expect(panel()?.querySelector('h2')?.textContent).toBe('누적 사망 기록 — 레벨 2, 7회');
    expect([...(panel()?.querySelectorAll('li') ?? [])].map((li) => li.textContent)).toEqual(['화살 발사대 ×5', '그냥 떨어짐 ×2']);
    expect(panel()?.querySelector('button')?.textContent).toContain('누적 사망 기록 지우기');
    await act(async () => { root.unmount(); });
  });

  it('shows the pause menu, the clear panel and the completion panel as in-game dialogs for the right states', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(App)); });
    const dialog = (name: string): Element | null => container.querySelector(`[role="dialog"][aria-label="${name}"]`);
    await act(async () => { push(base); });
    expect(dialog('일시정지')).toBeNull();
    expect(dialog('레벨 클리어')).toBeNull();

    await act(async () => { push({ ...base, paused: true }); });
    expect(dialog('일시정지')?.textContent).toContain('계속하기 (P)');
    expect(dialog('일시정지')?.textContent).toContain('소리 끄기 (M)');
    await act(async () => { push({ ...base, paused: true, muted: true }); });
    expect(dialog('일시정지')?.textContent).toContain('소리 켜기 (M)');

    // 클리어 창이 떠 있으면 정지 중이어도 클리어 창만 보인다.
    await act(async () => { push({ ...base, paused: true, cleared: true, runDeaths: 2, time: 41.25, best: { time: 41.25, deaths: 2 }, runDeathsByKind: { arrow: 2 } }); });
    expect(dialog('일시정지')).toBeNull();
    expect(dialog('레벨 클리어')?.querySelector('h2')?.textContent).toBe('CLEAR!');
    expect(dialog('레벨 클리어')?.textContent).toContain('41.3s');
    expect(dialog('레벨 클리어')?.textContent).toContain('화살 발사대 ×2');
    expect(dialog('레벨 클리어')?.textContent).toContain('다음 레벨 (N)');
    await act(async () => { push({ ...base, cleared: true, newRecord: true }); });
    expect(dialog('레벨 클리어')?.querySelector('h2')?.textContent).toBe('NEW RECORD!');

    // 마지막 레벨을 클리어하면 클리어 창 대신 완료 창.
    await act(async () => { push({ ...base, cleared: true, level: 3, levelCount: 3, bests: [{ time: 30, deaths: 1 }, null, { time: 50, deaths: 0 }] }); });
    expect(dialog('레벨 클리어')).toBeNull();
    expect(dialog('모든 레벨 클리어')?.textContent).toContain('30.0s / 1 FALLS');
    expect(dialog('모든 레벨 클리어')?.textContent).toContain('레벨 1부터 다시 (N)');
    await act(async () => { root.unmount(); });
  });

  it('keeps the HUD labels for screen readers while showing icons', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(App)); });
    const stats = (): string[] => [...container.querySelectorAll('.hud .hud-stat')].map((e) => e.textContent ?? '');
    await act(async () => { push({ ...base, deaths: 3, checkpoint: true }); });
    expect(stats()).toEqual(['LEVEL 1 / 3', 'FALLS 3', 'CHECKPOINT SAVED', 'TIME 5.0s', 'BEST —']);
    expect(container.querySelectorAll('.hud svg[aria-hidden="true"]').length).toBeGreaterThan(0);
    await act(async () => { root.unmount(); });
  });

  it('shows the run medal with the targets on the clear panel, and the best medal in the HUD and on the completion panel', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(App)); });
    const clear = (): Element | null => container.querySelector('[role="dialog"][aria-label="레벨 클리어"]');
    const medals = (el: Element | null): (string | null)[] => [...(el?.querySelectorAll('.medal') ?? [])].map((m) => m.getAttribute('aria-label'));

    // 레벨 1 목표: 금 72초, 은 94초.
    await act(async () => { push({ ...base, cleared: true, time: 80.4, runDeaths: 2, best: { time: 70, deaths: 0 } }); });
    expect(medals(clear())).toEqual(['은메달']);
    expect(clear()?.textContent).toContain('금 72초 · 은 94초');
    expect(clear()?.textContent).not.toContain('노데스');
    expect(medals(container.querySelector('.hud'))).toEqual(['금메달 · 노데스']); // 최고 기록(시간 70초, 최소 사망 0)
    expect(container.querySelector('.hud-best')?.textContent).toBe('BEST 70.0s / 0 FALLS'); // 메달은 글자에 섞이지 않는다

    await act(async () => { push({ ...base, cleared: true, time: 60, runDeaths: 0, best: { time: 60, deaths: 0 } }); });
    expect(medals(clear())).toEqual(['금메달 · 노데스']);
    expect(clear()?.textContent).toContain('★ 노데스');

    await act(async () => { push({ ...base, cleared: true, level: 3, levelCount: 3, bests: [{ time: 100, deaths: 3 }, null, { time: 150, deaths: 0 }] }); });
    expect(medals(container.querySelector('[role="dialog"][aria-label="모든 레벨 클리어"]'))).toEqual(['동메달', '은메달 · 노데스']); // 레벨 3 은메달 162초 이내
    await act(async () => { root.unmount(); });
  });
});
