import type { InputState } from '../world/World';
export class InputManager {
  private down = new Set<string>();
  private jumpQueued = false;
  private restartQueued = false;
  private debugQueued = false;
  private pauseQueued = false;
  private readonly keys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'Space', 'KeyR', 'KeyB', 'KeyP']);
  constructor(private readonly target: Window) {
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.onBlur);
  }
  private onDown = (event: KeyboardEvent): void => {
    if (!this.keys.has(event.code)) return;
    if (event.ctrlKey || event.metaKey) return; // 브라우저 단축키(예: Ctrl/Cmd+R 새로고침)를 가로채지 않는다
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;
    event.preventDefault();
    if (!this.down.has(event.code)) {
      if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) this.jumpQueued = true;
      if (event.code === 'KeyR') this.restartQueued = true;
      if (event.code === 'KeyB') this.debugQueued = true;
      if (event.code === 'KeyP') this.pauseQueued = true;
    }
    this.down.add(event.code);
  };
  private onUp = (event: KeyboardEvent): void => { this.down.delete(event.code); };
  private onBlur = (): void => { this.clearInput(); };
  // 탭이 백그라운드로 가거나 포커스를 잃었을 때 눌림 상태를 모두 비운다 —
  // 그렇지 않으면 포커스를 되찾았을 때 떼지 않은 키가 계속 눌린 것으로 남는다.
  clearInput(): void {
    this.down.clear();
    this.jumpQueued = false; this.restartQueued = false; this.debugQueued = false; this.pauseQueued = false;
  }
  consume(): { input: InputState; toggleDebug: boolean; togglePause: boolean } {
    const left = this.down.has('ArrowLeft') || this.down.has('KeyA');
    const right = this.down.has('ArrowRight') || this.down.has('KeyD');
    const horizontal = left === right ? 0 : left ? -1 : 1;
    const value = {
      input: { horizontal, jumpPressed: this.jumpQueued, restartPressed: this.restartQueued },
      toggleDebug: this.debugQueued,
      togglePause: this.pauseQueued,
    } as const;
    this.jumpQueued = false; this.restartQueued = false; this.debugQueued = false; this.pauseQueued = false;
    return value;
  }
  dispose(): void { this.target.removeEventListener('keydown', this.onDown); this.target.removeEventListener('keyup', this.onUp); this.target.removeEventListener('blur', this.onBlur); }
}
