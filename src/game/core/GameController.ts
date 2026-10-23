import { GameLoop } from './GameLoop';
import { InputManager } from './InputManager';
import { SoundPlayer } from '../audio/SoundPlayer';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { World, type GameSnapshot } from '../world/World';
// HUD에 보여줄 상태: 월드 스냅샷 + 컨트롤러가 가진 정지·음소거 상태.
export interface HudSnapshot extends GameSnapshot { paused: boolean; muted: boolean }
export class GameController {
  private readonly world = new World();
  private readonly renderer: CanvasRenderer;
  private readonly input = new InputManager(window);
  private readonly sound = new SoundPlayer(window);
  private readonly loop: GameLoop;
  private lastSnapshot = '';
  private paused = false;
  constructor(
    canvas: HTMLCanvasElement,
    private readonly onSnapshot: (snapshot: HudSnapshot) => void,
    onError: (error: unknown) => void,
  ) {
    this.renderer = new CanvasRenderer(canvas);
    this.loop = new GameLoop((dt) => {
      const state = this.input.consume();
      if (state.toggleDebug) this.renderer.debug = !this.renderer.debug;
      if (state.togglePause) this.paused = !this.paused;
      if (state.toggleMute) this.sound.muted = !this.sound.muted;
      // 정지 중에는 world.update를 건너뛰지만, 재시작(R)은 World.update 안에서만
      // 처리되므로 그대로 두면 정지 중 R 입력이 사라진다. 재시작은 정지 여부와
      // 무관하게 별도로 처리한다.
      if (this.paused) {
        if (state.input.restartPressed) this.world.reset();
      } else {
        this.world.update(dt, state.input);
      }
      for (const event of this.world.drainEvents()) this.sound.play(event);
      this.publishSnapshot();
    }, (metrics) => this.renderer.render(this.world, metrics, this.paused), onError);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }
  private publishSnapshot(): void {
    const snapshot = { ...this.world.snapshot(), paused: this.paused, muted: this.sound.muted };
    const serialized = JSON.stringify(snapshot);
    if (serialized !== this.lastSnapshot) { this.lastSnapshot = serialized; this.onSnapshot(snapshot); }
  }
  // 탭이 백그라운드로 가면 강제로 일시 정지한다 — 보이지 않는 동안 쌓인 큰 dt가
  // 물리 스텝을 몰아서 처리하며 순간이동/관통을 일으키는 것을 막는다. 탭이 다시
  // 보여도 자동으로 재생하지 않고, 사용자가 P로 직접 재개하게 한다.
  private onVisibilityChange = (): void => {
    if (document.hidden) { this.paused = true; this.input.clearInput(); this.publishSnapshot(); }
  };
  // 키보드(R/P) 외에 화면의 버튼에서도 같은 동작을 호출할 수 있도록 공개한다 —
  // 터치/마우스로만 조작하는 사용자나 스크린 리더 사용자를 위한 접근성 통로.
  restart(): void { this.world.reset(); this.publishSnapshot(); }
  togglePause(): void { this.paused = !this.paused; this.publishSnapshot(); }
  toggleMute(): void { this.sound.muted = !this.sound.muted; this.publishSnapshot(); }
  start(): void { this.publishSnapshot(); this.loop.start(); }
  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.sound.dispose();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
