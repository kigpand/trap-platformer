import type { InputState } from '../world/World';
// 화면의 터치 버튼. 키보드 키와 같은 눌림 집합(down)에 별도 코드로 넣어, 키보드로 같은 방향을
// 누르고 있다가 터치를 떼도 키보드 입력이 풀리지 않게 한다.
export type TouchAction = 'left' | 'right' | 'jump';
const TOUCH_CODES: Record<TouchAction, string> = { left: 'TouchLeft', right: 'TouchRight', jump: 'TouchJump' };
export class InputManager {
  private down = new Set<string>();
  private jumpQueued = false;
  private restartQueued = false;
  private debugQueued = false;
  private pauseQueued = false;
  private muteQueued = false;
  private readonly keys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'Space', 'KeyR', 'KeyB', 'KeyP', 'KeyM']);
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
    if (active instanceof HTMLButtonElement && event.code === 'Space') return; // 포커스된 버튼의 Space 활성화는 보존하되, 이동 키는 계속 게임으로 보낸다
    event.preventDefault();
    if (!this.down.has(event.code)) {
      if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) this.jumpQueued = true;
      if (event.code === 'KeyR') this.restartQueued = true;
      if (event.code === 'KeyB') this.debugQueued = true;
      if (event.code === 'KeyP') this.pauseQueued = true;
      if (event.code === 'KeyM') this.muteQueued = true;
    }
    this.down.add(event.code);
  };
  private onUp = (event: KeyboardEvent): void => { this.down.delete(event.code); };
  setTouch(action: TouchAction, pressed: boolean): void {
    const code = TOUCH_CODES[action];
    if (!pressed) { this.down.delete(code); return; }
    if (action === 'jump' && !this.down.has(code)) this.jumpQueued = true; // 키보드와 같이 새로 누르는 순간에만 점프
    this.down.add(code);
  }
  private onBlur = (): void => { this.clearInput(); };
  // 탭이 백그라운드로 가거나 포커스를 잃었을 때 눌림 상태를 모두 비운다 —
  // 그렇지 않으면 포커스를 되찾았을 때 떼지 않은 키가 계속 눌린 것으로 남는다.
  clearInput(): void {
    this.down.clear();
    this.jumpQueued = false; this.restartQueued = false; this.debugQueued = false; this.pauseQueued = false; this.muteQueued = false;
  }
  consume(): { input: InputState; toggleDebug: boolean; togglePause: boolean; toggleMute: boolean } {
    const left = this.down.has('ArrowLeft') || this.down.has('KeyA') || this.down.has(TOUCH_CODES.left);
    const right = this.down.has('ArrowRight') || this.down.has('KeyD') || this.down.has(TOUCH_CODES.right);
    const horizontal = left === right ? 0 : left ? -1 : 1;
    const value = {
      input: { horizontal, jumpPressed: this.jumpQueued, restartPressed: this.restartQueued },
      toggleDebug: this.debugQueued,
      togglePause: this.pauseQueued,
      toggleMute: this.muteQueued,
    } as const;
    this.jumpQueued = false; this.restartQueued = false; this.debugQueued = false; this.pauseQueued = false; this.muteQueued = false;
    return value;
  }
  dispose(): void { this.target.removeEventListener('keydown', this.onDown); this.target.removeEventListener('keyup', this.onUp); this.target.removeEventListener('blur', this.onBlur); }
}
