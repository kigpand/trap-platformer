// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { InputManager } from '../../../src/game/core/InputManager';

describe('InputManager', () => {
  it('treats a plain R press as a restart request', () => {
    const input = new InputManager(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    expect(input.consume().input.restartPressed).toBe(true);
    input.dispose();
  });

  it('ignores Ctrl+R so the browser refresh shortcut still reaches the browser', () => {
    const input = new InputManager(window);
    const event = new KeyboardEvent('keydown', { code: 'KeyR', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(input.consume().input.restartPressed).toBe(false);
    expect(event.defaultPrevented).toBe(false); // preventDefault()를 호출하지 않아야 새로고침이 막히지 않는다
    input.dispose();
  });

  it('ignores Cmd/Meta+R the same way', () => {
    const input = new InputManager(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', metaKey: true }));
    expect(input.consume().input.restartPressed).toBe(false);
    input.dispose();
  });

  it('still treats other tracked keys normally when no modifier is held', () => {
    const input = new InputManager(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    expect(input.consume().input.horizontal).toBe(1);
    input.dispose();
  });

  it('treats a P press as a pause toggle request', () => {
    const input = new InputManager(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
    expect(input.consume().togglePause).toBe(true);
    input.dispose();
  });

  it('treats an N press as a next-level request, once per press', () => {
    const input = new InputManager(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' })); // 누르고 있는 동안의 반복 keydown
    expect(input.consume().nextLevel).toBe(true);
    expect(input.consume().nextLevel).toBe(false);
    input.dispose();
  });

  it('treats an M press as a mute toggle request', () => {
    const input = new InputManager(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
    expect(input.consume().toggleMute).toBe(true);
    expect(input.consume().toggleMute).toBe(false);
    input.dispose();
  });

  it('only reports the pause toggle once per press (edge-triggered, not held)', () => {
    const input = new InputManager(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); // 키를 누르고 있는 동안 반복 발생하는 keydown
    expect(input.consume().togglePause).toBe(true);
    expect(input.consume().togglePause).toBe(false);
    input.dispose();
  });

  it('clears held keys and queued actions on blur so a key stuck from before a tab switch does not persist', () => {
    const input = new InputManager(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
    window.dispatchEvent(new Event('blur'));
    const state = input.consume();
    expect(state.input.horizontal).toBe(0);
    expect(state.togglePause).toBe(false);
    input.dispose();
  });

  it('leaves Space/Enter alone when a <button> (e.g. the on-screen pause/restart controls) has focus', () => {
    // 코덱스 리뷰: 버튼에 포커스가 있어도 전역 리스너가 Space를 가로채 점프로 소비하고
    // preventDefault()까지 호출해서, 포커스된 버튼을 Space/Enter로 "누르는" 표준 키보드
    // 동작이 깨졌다.
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    const input = new InputManager(window);
    const event = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
    window.dispatchEvent(event);
    expect(input.consume().input.jumpPressed).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    input.dispose();
    button.remove();
  });

  it('still captures movement keys while a <button> has focus', () => {
    // 마우스로 정지/재시작 버튼을 누르면 포커스가 버튼에 남는다 — 그 상태에서도 방향키 이동은 막히지 않아야 한다.
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    const input = new InputManager(window);
    const event = new KeyboardEvent('keydown', { code: 'ArrowRight', cancelable: true });
    window.dispatchEvent(event);
    expect(input.consume().input.horizontal).toBe(1);
    expect(event.defaultPrevented).toBe(true);
    input.dispose();
    button.remove();
  });

  it('treats a held touch direction like a held key', () => {
    const input = new InputManager(window);
    input.setTouch('left', true);
    expect(input.consume().input.horizontal).toBe(-1);
    expect(input.consume().input.horizontal).toBe(-1); // 떼기 전까지 유지
    input.setTouch('left', false);
    expect(input.consume().input.horizontal).toBe(0);
    input.dispose();
  });

  it('jumps once per touch press, not every frame the jump button is held', () => {
    const input = new InputManager(window);
    input.setTouch('jump', true);
    input.setTouch('jump', true); // 같은 손가락의 중복 pointerdown
    expect(input.consume().input.jumpPressed).toBe(true);
    expect(input.consume().input.jumpPressed).toBe(false);
    input.setTouch('jump', false);
    input.setTouch('jump', true);
    expect(input.consume().input.jumpPressed).toBe(true);
    input.dispose();
  });

  it('releasing a touch direction does not release the same direction held on the keyboard', () => {
    const input = new InputManager(window);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    input.setTouch('right', true);
    input.setTouch('right', false);
    expect(input.consume().input.horizontal).toBe(1);
    input.dispose();
  });

  it('clears held touch input on blur, like held keys', () => {
    const input = new InputManager(window);
    input.setTouch('right', true);
    window.dispatchEvent(new Event('blur'));
    expect(input.consume().input.horizontal).toBe(0);
    input.dispose();
  });
});

