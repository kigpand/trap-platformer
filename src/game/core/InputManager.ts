import type { InputState } from '../world/World';
// 화면의 터치 버튼. 키보드 키와 같은 눌림 집합(down)에 별도 코드로 넣어, 키보드로 같은 방향을
// 누르고 있다가 터치를 떼도 키보드 입력이 풀리지 않게 한다.
export type TouchAction = 'left' | 'right' | 'jump';
const TOUCH_CODES: Record<TouchAction, string> = { left: 'TouchLeft', right: 'TouchRight', jump: 'TouchJump' };
// 게임패드(Gamepad API)는 이벤트가 아니라 consume()마다 상태를 읽는다. 버튼 번호는 표준 배치(standard mapping) 기준이다.
// 연결이 끊기면 목록에서 빠지므로 눌린 채 남는 입력이 없다. 테스트에서는 읽기 함수를 바꿔 끼운다.
export interface PadState { readonly index: number; readonly axes: readonly number[]; readonly buttons: readonly { readonly pressed: boolean }[] }
export type ReadPads = () => readonly (PadState | null)[];
const PAD = { jump: 0, nextLevel: 3, restart: 8, pause: 9, up: 12, left: 14, right: 15 } as const;
const STICK_DEADZONE = 0.5;
export class InputManager {
  private down = new Set<string>();
  private jumpQueued = false;
  private restartQueued = false;
  private debugQueued = false;
  private pauseQueued = false;
  private muteQueued = false;
  private nextLevelQueued = false;
  private readonly keys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'Space', 'KeyR', 'KeyB', 'KeyP', 'KeyM', 'KeyN']);
  private padPrev = new Map<number, readonly boolean[]>(); // 패드별 직전 버튼 상태 — 새로 누른 순간만 잡는다
  constructor(private readonly target: Window, private readonly readPads: ReadPads = () => ('getGamepads' in target.navigator ? target.navigator.getGamepads() : [])) {
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
      if (event.code === 'KeyN') this.nextLevelQueued = true;
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
    this.jumpQueued = false; this.restartQueued = false; this.debugQueued = false; this.pauseQueued = false; this.muteQueued = false; this.nextLevelQueued = false;
  }
  // 게임패드를 읽어 누르고 있는 방향을 돌려주고, 새로 누른 버튼은 키보드와 같은 대기 플래그에 넣는다.
  private pollPads(): { left: boolean; right: boolean } {
    let left = false; let right = false;
    const seen = new Set<number>();
    for (const pad of this.readPads()) {
      if (!pad) continue;
      seen.add(pad.index);
      const pressed = pad.buttons.map((b) => b.pressed);
      const prev = this.padPrev.get(pad.index) ?? [];
      const tapped = (i: number): boolean => pressed[i] === true && prev[i] !== true;
      const stick = pad.axes[0] ?? 0;
      if (pressed[PAD.left] || stick <= -STICK_DEADZONE) left = true;
      if (pressed[PAD.right] || stick >= STICK_DEADZONE) right = true;
      if (tapped(PAD.jump) || tapped(PAD.up)) this.jumpQueued = true;
      if (tapped(PAD.restart)) this.restartQueued = true;
      if (tapped(PAD.pause)) this.pauseQueued = true;
      if (tapped(PAD.nextLevel)) this.nextLevelQueued = true;
      this.padPrev.set(pad.index, pressed);
    }
    for (const index of this.padPrev.keys()) if (!seen.has(index)) this.padPrev.delete(index);
    return { left, right };
  }
  consume(): { input: InputState; toggleDebug: boolean; togglePause: boolean; toggleMute: boolean; nextLevel: boolean } {
    const pad = this.pollPads();
    const left = this.down.has('ArrowLeft') || this.down.has('KeyA') || this.down.has(TOUCH_CODES.left) || pad.left;
    const right = this.down.has('ArrowRight') || this.down.has('KeyD') || this.down.has(TOUCH_CODES.right) || pad.right;
    const horizontal = left === right ? 0 : left ? -1 : 1;
    const value = {
      input: { horizontal, jumpPressed: this.jumpQueued, restartPressed: this.restartQueued },
      toggleDebug: this.debugQueued,
      togglePause: this.pauseQueued,
      toggleMute: this.muteQueued,
      nextLevel: this.nextLevelQueued,
    } as const;
    this.jumpQueued = false; this.restartQueued = false; this.debugQueued = false; this.pauseQueued = false; this.muteQueued = false; this.nextLevelQueued = false;
    return value;
  }
  dispose(): void { this.target.removeEventListener('keydown', this.onDown); this.target.removeEventListener('keyup', this.onUp); this.target.removeEventListener('blur', this.onBlur); }
}
