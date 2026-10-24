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

// 배경 음악: 독자적으로 만든 4마디 루프(A 단조 펜타토닉, 8분음표 32스텝). null은 쉼표.
// 멜로디는 MIDI 음 번호, 베이스는 마디마다 1·3박에 근음을 친다.
const MUSIC_STEP_SECONDS = 60 / 140 / 2; // 140 BPM의 8분음표
const MUSIC_LOOKAHEAD_SECONDS = 0.3; // 프레임 지연에 끊기지 않도록 이만큼 앞서 예약한다
const MUSIC_VOLUME = 0.35; // 효과음보다 뒤로 물러나도록
const MELODY: readonly (number | null)[] = [
  69, null, 72, null, 74, 72, 69, null, 67, null, 69, null, 72, null, null, null,
  69, null, 72, null, 76, 74, 72, null, 74, null, 72, null, 69, null, null, null,
];
const BASS_ROOTS: readonly number[] = [45, 41, 48, 43]; // A2, F2, C3, G2
const midiToHz = (note: number): number => 440 * 2 ** ((note - 69) / 12);

// 브라우저 자동 재생 정책상 AudioContext는 사용자 제스처 안에서 만들거나 재개해야 소리가 난다.
// 첫 keydown/pointerdown 때 컨텍스트를 준비하고, 그 전에 요청된 소리는 조용히 건너뛴다.
// 모든 음은 공통 master 게인을 거친다 — 음소거 시 master를 0으로 내려 이미 재생 중이거나
// 예약된 음까지 바로 끊는다(새 play()만 막으면 클리어 음 도중 음소거해도 남은 음이 계속 난다).
// 음량(volume)도 같은 master 게인에 곱해져 음악과 효과음에 함께 적용된다.
export class SoundPlayer {
  private isMuted = false;
  private level = 1;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  // 음악은 별도 버스를 거친다. 멈출 때 버스를 페이드아웃하고 버리면, 이미 예약해 둔 음까지 함께 사라진다.
  private musicBus: GainNode | null = null;
  private musicStep = 0;
  private nextMusicTime = 0;
  constructor(private readonly target: Window) {
    target.addEventListener('keydown', this.unlock);
    target.addEventListener('pointerdown', this.unlock);
  }
  get muted(): boolean { return this.isMuted; }
  set muted(value: boolean) { this.isMuted = value; this.applyMasterGain(); }
  get volume(): number { return this.level; }
  set volume(value: number) { this.level = Math.min(1, Math.max(0, value)); this.applyMasterGain(); }
  private applyMasterGain(): void {
    if (this.context && this.master) this.master.gain.setValueAtTime(this.isMuted ? 0 : this.level, this.context.currentTime);
  }
  private unlock = (): void => {
    if (typeof AudioContext === 'undefined') return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.isMuted ? 0 : this.level;
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
  // 게임 루프가 매 스텝 호출한다. playing이면 앞으로 MUSIC_LOOKAHEAD_SECONDS만큼의 음을 미리 예약하고,
  // 아니면(일시정지·음소거) 음악 버스를 짧게 페이드아웃해 버린다. 다시 재생하면 루프는 멈춘 지점부터 이어진다.
  updateMusic(playing: boolean): void {
    const ctx = this.context;
    const master = this.master;
    if (!ctx || !master || ctx.state !== 'running') return;
    if (!playing || this.isMuted) {
      if (this.musicBus) { this.musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.03); this.musicBus = null; }
      return;
    }
    if (!this.musicBus) {
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = MUSIC_VOLUME;
      this.musicBus.connect(master);
      this.nextMusicTime = ctx.currentTime + 0.05;
    }
    // 긴 프레임 지연 뒤에 밀린 음을 한꺼번에 쏟아내지 않고 지금부터 다시 맞춘다.
    if (this.nextMusicTime < ctx.currentTime) this.nextMusicTime = ctx.currentTime + 0.05;
    while (this.nextMusicTime < ctx.currentTime + MUSIC_LOOKAHEAD_SECONDS) {
      this.scheduleMusicStep(ctx, this.musicBus, this.musicStep, this.nextMusicTime);
      this.musicStep = (this.musicStep + 1) % MELODY.length;
      this.nextMusicTime += MUSIC_STEP_SECONDS;
    }
  }
  private scheduleMusicStep(ctx: AudioContext, bus: GainNode, step: number, at: number): void {
    const melody = MELODY[step];
    if (melody !== null) this.scheduleTone(ctx, bus, 'square', 0.12, midiToHz(melody), at, MUSIC_STEP_SECONDS * 0.9);
    if (step % 4 === 0) this.scheduleTone(ctx, bus, 'triangle', 0.3, midiToHz(BASS_ROOTS[Math.floor(step / 8)]), at, MUSIC_STEP_SECONDS * 1.8);
  }
  private scheduleTone(ctx: AudioContext, bus: GainNode, wave: OscillatorType, volume: number, hz: number, at: number, duration: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(hz, at);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    osc.connect(gain).connect(bus);
    osc.start(at);
    osc.stop(at + duration);
  }
  dispose(): void {
    this.target.removeEventListener('keydown', this.unlock);
    this.target.removeEventListener('pointerdown', this.unlock);
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.musicBus = null;
  }
}
