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
});
