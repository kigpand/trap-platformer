const STEP = 1 / 60;
const MAX_FRAME_DELTA = 0.1;
const MAX_STEPS_PER_FRAME = 6;
export class GameLoop {
  private raf: number | undefined;
  private previous: number | undefined;
  private accumulator = 0;
  constructor(private readonly update: (dt: number) => void, private readonly render: () => void) {}
  start(): void {
    if (this.raf !== undefined) return;
    this.raf = requestAnimationFrame(this.frame);
  }
  stop(): void {
    if (this.raf !== undefined) cancelAnimationFrame(this.raf);
    this.raf = undefined; this.previous = undefined; this.accumulator = 0;
  }
  private frame = (now: number): void => {
    if (this.previous === undefined) this.previous = now;
    const dt = Math.min(MAX_FRAME_DELTA, Math.max(0, (now - this.previous) / 1000));
    this.previous = now;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP && steps < MAX_STEPS_PER_FRAME) {
      this.update(STEP); this.accumulator -= STEP; steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };
}
