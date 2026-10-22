import type { WorldEvent } from '../world/World';

// 외부 음원 파일 없이 Web Audio 오실레이터로 효과음을 합성한다(독자적인 음향 자료).
// 음 하나 = [주파수 시작(Hz), 주파수 끝(Hz), 시작 시각(s), 길이(s)].
type Note = readonly [from: number, to: number, at: number, duration: number];
interface Sound { wave: OscillatorType; volume: number; notes: readonly Note[] }
const SOUNDS: Record<WorldEvent, Sound> = {
  jump: { wave: 'square', volume: 0.08, notes: [[320, 640, 0, 0.12]] },
  death: { wave: 'sawtooth', volume: 0.1, notes: [[440, 80, 0, 0.45]] },
  checkpoint: { wave: 'triangle', volume: 0.15, notes: [[660, 660, 0, 0.09], [990, 990, 0.1, 0.14]] },
  clear: { wave: 'triangle', volume: 0.15, notes: [[523, 523, 0, 0.12], [659, 659, 0.13, 0.12], [784, 784, 0.26, 0.12], [1047, 1047, 0.39, 0.3]] },
};

// 브라우저 자동 재생 정책상 AudioContext는 사용자 제스처 안에서 만들거나 재개해야 소리가 난다.
// 첫 keydown/pointerdown 때 컨텍스트를 준비하고, 그 전에 요청된 소리는 조용히 건너뛴다.
export class SoundPlayer {
  muted = false;
  private context: AudioContext | null = null;
  constructor(private readonly target: Window) {
    target.addEventListener('keydown', this.unlock);
    target.addEventListener('pointerdown', this.unlock);
  }
  private unlock = (): void => {
    if (typeof AudioContext === 'undefined') return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
  };
  play(event: WorldEvent): void {
    const ctx = this.context;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const sound = SOUNDS[event];
    for (const [from, to, at, duration] of sound.notes) {
      const start = ctx.currentTime + at;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = sound.wave;
      osc.frequency.setValueAtTime(from, start);
      osc.frequency.exponentialRampToValueAtTime(to, start + duration);
      gain.gain.setValueAtTime(sound.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration); // 끝에서 툭 끊기는 잡음을 막는다
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    }
  }
  dispose(): void {
    this.target.removeEventListener('keydown', this.unlock);
    this.target.removeEventListener('pointerdown', this.unlock);
    void this.context?.close();
    this.context = null;
  }
}
