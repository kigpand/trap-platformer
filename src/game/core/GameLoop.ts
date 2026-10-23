const STEP = 1 / 60;
const MAX_FRAME_DELTA = 0.1;
const MAX_STEPS_PER_FRAME = 6;
// 렌더 콜백에 넘기는 디버그용 프레임 지표. fps는 급격한 프레임 간 변동을 완화하기 위해
// 지수 이동 평균을 쓴다 — 매 프레임 순간값을 그대로 보여주면 숫자가 너무 튄다.
export interface FrameMetrics { fps: number; steps: number }
export class GameLoop {
  private raf: number | undefined;
  private previous: number | undefined;
  private accumulator = 0;
  private smoothedFps = 0;
  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (metrics: FrameMetrics) => void,
    private readonly onError: (error: unknown) => void,
  ) {}
  start(): void {
    if (this.raf !== undefined) return;
    this.raf = requestAnimationFrame(this.frame);
  }
  stop(): void {
    if (this.raf !== undefined) cancelAnimationFrame(this.raf);
    this.raf = undefined; this.previous = undefined; this.accumulator = 0; this.smoothedFps = 0;
  }
  // update/render에서 예외가 나면 다음 RAF가 예약되지 않아 게임이 조용히 멈춘다.
  // 루프를 정리하고 onError로 알려 UI가 복구 안내를 띄울 수 있게 한다.
  private frame = (now: number): void => {
    try {
      this.tick(now);
    } catch (error) {
      this.stop();
      this.onError(error);
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };
  private tick(now: number): void {
    if (this.previous === undefined) this.previous = now;
    const frameDelta = Math.max(0, (now - this.previous) / 1000);
    const dt = Math.min(MAX_FRAME_DELTA, frameDelta);
    this.previous = now;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP && steps < MAX_STEPS_PER_FRAME) {
      this.update(STEP); this.accumulator -= STEP; steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    const instantFps = frameDelta > 0 ? 1 / frameDelta : 0;
    this.smoothedFps = this.smoothedFps === 0 ? instantFps : this.smoothedFps * 0.9 + instantFps * 0.1;
    this.render({ fps: this.smoothedFps, steps });
  }
}
