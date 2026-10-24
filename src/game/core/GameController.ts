import { GameLoop } from './GameLoop';
import { InputManager } from './InputManager';
import { SoundPlayer } from '../audio/SoundPlayer';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { World, type GameSnapshot } from '../world/World';
// 클리어 시간과 최소 사망 수는 서로 다른 런에서 나올 수 있어 따로 갱신한다.
export interface BestRecord { time: number; deaths: number }
// HUD에 보여줄 상태: 월드 스냅샷 + 컨트롤러가 가진 정지·음소거·최고 기록 상태.
// newRecord는 마지막 클리어가 기록을 하나라도 갱신했는지(수동 재시작 시 해제).
export interface HudSnapshot extends GameSnapshot { paused: boolean; muted: boolean; best: BestRecord | null; newRecord: boolean }
const MUTED_STORAGE_KEY = 'trap-runner:muted';
const BEST_STORAGE_KEY = 'trap-runner:best';
// 음소거 설정은 새로고침 후에도 유지한다. 시크릿 모드·저장소 차단 등으로 localStorage
// 접근이 예외를 던질 수 있으므로, 실패하면 기본값(소리 켬)으로 동작하고 저장은 건너뛴다.
function loadMuted(): boolean {
  try { return localStorage.getItem(MUTED_STORAGE_KEY) === '1'; } catch { return false; }
}
function saveMuted(muted: boolean): void {
  try { localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0'); } catch { /* 저장 실패 시 이번 세션에만 적용 */ }
}
// 저장된 값이 깨졌거나(수동 편집 등) 형식이 다르면 기록이 없는 것으로 본다.
function loadBest(): BestRecord | null {
  try {
    const raw = localStorage.getItem(BEST_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('time' in parsed) || !('deaths' in parsed)) return null;
    const { time, deaths } = parsed;
    if (typeof time !== 'number' || typeof deaths !== 'number' || !(time >= 0) || !Number.isInteger(deaths) || deaths < 0) return null;
    return { time, deaths };
  } catch { return null; }
}
function saveBest(best: BestRecord): void {
  try { localStorage.setItem(BEST_STORAGE_KEY, JSON.stringify(best)); } catch { /* 저장 실패 시 이번 세션에만 적용 */ }
}
export function mergeBest(best: BestRecord | null, run: BestRecord): { best: BestRecord; improved: boolean } {
  if (!best) return { best: run, improved: true };
  const merged = { time: Math.min(best.time, run.time), deaths: Math.min(best.deaths, run.deaths) };
  return { best: merged, improved: merged.time < best.time || merged.deaths < best.deaths };
}
export class GameController {
  private readonly world = new World();
  private readonly renderer: CanvasRenderer;
  private readonly input = new InputManager(window);
  private readonly sound = new SoundPlayer(window);
  private readonly loop: GameLoop;
  private lastSnapshot = '';
  private paused = false;
  private best: BestRecord | null = loadBest();
  private newRecord = false;
  constructor(
    canvas: HTMLCanvasElement,
    private readonly onSnapshot: (snapshot: HudSnapshot) => void,
    onError: (error: unknown) => void,
  ) {
    this.renderer = new CanvasRenderer(canvas);
    this.sound.muted = loadMuted();
    this.loop = new GameLoop((dt) => {
      const state = this.input.consume();
      if (state.toggleDebug) this.renderer.debug = !this.renderer.debug;
      if (state.togglePause) this.paused = !this.paused;
      if (state.toggleMute) this.setMuted(!this.sound.muted);
      // 정지 중에는 world.update를 건너뛰지만, 재시작(R)은 World.update 안에서만
      // 처리되므로 그대로 두면 정지 중 R 입력이 사라진다. 재시작은 정지 여부와
      // 무관하게 별도로 처리한다.
      if (this.paused) {
        if (state.input.restartPressed) this.restartRun();
      } else {
        if (state.input.restartPressed) this.newRecord = false;
        this.world.update(dt, state.input);
      }
      for (const event of this.world.drainEvents()) {
        if (event === 'clear') this.recordClear();
        this.sound.play(event);
      }
      this.publishSnapshot();
    }, (metrics) => this.renderer.render(this.world, metrics, this.paused), onError);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }
  private publishSnapshot(): void {
    const snapshot = { ...this.world.snapshot(), paused: this.paused, muted: this.sound.muted, best: this.best, newRecord: this.newRecord };
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
  restart(): void { this.restartRun(); this.publishSnapshot(); }
  private restartRun(): void { this.world.reset(); this.newRecord = false; }
  private recordClear(): void {
    const snap = this.world.snapshot();
    // 다른 탭이 그사이 더 좋은 기록을 저장했을 수 있다 — 시작 시 읽은 기록만 믿으면 더 나쁜
    // 기록으로 덮어쓰고 NEW RECORD!까지 띄운다. 비교·저장 직전에 저장소를 다시 읽어 합친다.
    const stored = loadBest();
    const known = stored ? mergeBest(this.best, stored).best : this.best;
    const { best, improved } = mergeBest(known, { time: snap.time, deaths: snap.runDeaths });
    this.best = best;
    this.newRecord = improved;
    if (improved) saveBest(best);
  }
  togglePause(): void { this.paused = !this.paused; this.publishSnapshot(); }
  toggleMute(): void { this.setMuted(!this.sound.muted); this.publishSnapshot(); }
  private setMuted(muted: boolean): void { this.sound.muted = muted; saveMuted(muted); }
  start(): void { this.publishSnapshot(); this.loop.start(); }
  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.sound.dispose();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
