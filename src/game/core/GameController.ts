import { GameLoop } from './GameLoop';
import { InputManager } from './InputManager';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { World, type GameSnapshot } from '../world/World';
export class GameController {
  private readonly world = new World();
  private readonly renderer: CanvasRenderer;
  private readonly input = new InputManager(window);
  private readonly loop: GameLoop;
  private lastSnapshot = '';
  private paused = false;
  constructor(canvas: HTMLCanvasElement, private readonly onSnapshot: (snapshot: GameSnapshot) => void) {
    this.renderer = new CanvasRenderer(canvas);
    this.loop = new GameLoop((dt) => {
      const state = this.input.consume();
      if (state.toggleDebug) this.renderer.debug = !this.renderer.debug;
      if (state.togglePause) this.paused = !this.paused;
      if (!this.paused) {
        this.world.update(dt, state.input);
        const snapshot = this.world.snapshot();
        const serialized = JSON.stringify(snapshot);
        if (serialized !== this.lastSnapshot) { this.lastSnapshot = serialized; this.onSnapshot(snapshot); }
      }
    }, (metrics) => this.renderer.render(this.world, metrics, this.paused));
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }
  // 탭이 백그라운드로 가면 강제로 일시 정지한다 — 보이지 않는 동안 쌓인 큰 dt가
  // 물리 스텝을 몰아서 처리하며 순간이동/관통을 일으키는 것을 막는다. 탭이 다시
  // 보여도 자동으로 재생하지 않고, 사용자가 P로 직접 재개하게 한다.
  private onVisibilityChange = (): void => {
    if (document.hidden) { this.paused = true; this.input.clearInput(); }
  };
  start(): void { this.onSnapshot(this.world.snapshot()); this.loop.start(); }
  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
