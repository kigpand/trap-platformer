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
// 모든 음은 공통 master 게인을 거친다 — 음소거 시 master를 0으로 내려 이미 재생 중이거나
// 예약된 음까지 바로 끊는다(새 play()만 막으면 클리어 음 도중 음소거해도 남은 음이 계속 난다).
export class SoundPlayer {
  private isMuted = false;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  constructor(private readonly target: Window) {
    target.addEventListener('keydown', this.unlock);
    target.addEventListener('pointerdown', this.unlock);
  }
  get muted(): boolean { return this.isMuted; }
  set muted(value: boolean) {
    this.isMuted = value;
    if (this.context && this.master) this.master.gain.setValueAtTime(value ? 0 : 1, this.context.currentTime);
  }
  private unlock = (): void => {
    if (typeof AudioContext === 'undefined') return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.isMuted ? 0 : 1;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  };
  play(event: WorldEvent): void {
    const ctx = this.context;
    const master = this.master;
    if (this.isMuted || !ctx || !master || ctx.state !== 'running') return;
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
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + duration);
    }
  }
  dispose(): void {
    this.target.removeEventListener('keydown', this.unlock);
    this.target.removeEventListener('pointerdown', this.unlock);
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
