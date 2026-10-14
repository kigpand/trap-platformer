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
  constructor(canvas: HTMLCanvasElement, private readonly onSnapshot: (snapshot: GameSnapshot) => void) {
    this.renderer = new CanvasRenderer(canvas);
    this.loop = new GameLoop((dt) => {
      const state = this.input.consume();
      if (state.toggleDebug) this.renderer.debug = !this.renderer.debug;
      this.world.update(dt, state.input);
      const snapshot = this.world.snapshot();
      const serialized = JSON.stringify(snapshot);
      if (serialized !== this.lastSnapshot) { this.lastSnapshot = serialized; this.onSnapshot(snapshot); }
    }, (metrics) => this.renderer.render(this.world, metrics));
  }
  start(): void { this.onSnapshot(this.world.snapshot()); this.loop.start(); }
  dispose(): void { this.loop.stop(); this.input.dispose(); }
}
