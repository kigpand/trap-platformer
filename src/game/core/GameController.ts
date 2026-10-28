import { GameLoop } from './GameLoop';
import { InputManager, type TouchAction } from './InputManager';
import { SoundPlayer } from '../audio/SoundPlayer';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { World, type GameSnapshot } from '../world/World';
import { LEVELS } from '../world/level';
// 클리어 시간과 최소 사망 수는 서로 다른 런에서 나올 수 있어 따로 갱신한다.
export interface BestRecord { time: number; deaths: number }
// HUD에 보여줄 상태: 월드 스냅샷 + 컨트롤러가 가진 정지·음소거·레벨·최고 기록 상태.
// level은 1부터 센다. best는 현재 레벨의 최고 기록, bests는 레벨 순서대로 모든 레벨의 기록(완료 화면용).
// newRecord는 마지막 클리어가 기록을 하나라도 갱신했는지(수동 재시작·레벨 전환 시 해제).
export interface HudSnapshot extends GameSnapshot {
  paused: boolean; muted: boolean; volume: number;
  level: number; levelCount: number; best: BestRecord | null; bests: (BestRecord | null)[]; newRecord: boolean;
}
const MUTED_STORAGE_KEY = 'trap-runner:muted';
const VOLUME_STORAGE_KEY = 'trap-runner:volume';
const DEFAULT_VOLUME = 0.8;
// 레벨별 최고 기록 저장 키. 맵 3배 확장으로 길어진 레벨은 예전(짧은 맵) 기록을 깰 수 없으므로 새 키로 새로 시작한다 —
// 확장한 레벨만 키를 바꾼다(docs/roadmap.md 약올리는 함정 5번). 예전 키(레벨 1 'trap-runner:best')는 더 읽지 않는다.
const BEST_STORAGE_KEYS = ['trap-runner:best:v2:1', 'trap-runner:best:2', 'trap-runner:best:3'];
const bestStorageKey = (levelIndex: number): string => BEST_STORAGE_KEYS[levelIndex] ?? `trap-runner:best:${levelIndex + 1}`;
// 음소거 설정은 새로고침 후에도 유지한다. 시크릿 모드·저장소 차단 등으로 localStorage
// 접근이 예외를 던질 수 있으므로, 실패하면 기본값(소리 켬)으로 동작하고 저장은 건너뛴다.
function loadMuted(): boolean {
  try { return localStorage.getItem(MUTED_STORAGE_KEY) === '1'; } catch { return false; }
}
function saveMuted(muted: boolean): void {
  try { localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0'); } catch { /* 저장 실패 시 이번 세션에만 적용 */ }
}
// 음량(0~1)도 같은 방식으로 저장한다. 값이 없거나 범위를 벗어나면 기본값을 쓴다.
function loadVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    const value = raw === null ? NaN : Number(raw);
    return value >= 0 && value <= 1 ? value : DEFAULT_VOLUME;
  } catch { return DEFAULT_VOLUME; }
}
function saveVolume(volume: number): void {
  try { localStorage.setItem(VOLUME_STORAGE_KEY, String(volume)); } catch { /* 저장 실패 시 이번 세션에만 적용 */ }
}
// 저장된 값이 깨졌거나(수동 편집 등) 형식이 다르면 기록이 없는 것으로 본다.
function loadBest(levelIndex: number): BestRecord | null {
  try {
    const raw = localStorage.getItem(bestStorageKey(levelIndex));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('time' in parsed) || !('deaths' in parsed)) return null;
    const { time, deaths } = parsed;
    if (typeof time !== 'number' || typeof deaths !== 'number' || !(time >= 0) || !Number.isInteger(deaths) || deaths < 0) return null;
    return { time, deaths };
  } catch { return null; }
}
function saveBest(levelIndex: number, best: BestRecord): void {
  try { localStorage.setItem(bestStorageKey(levelIndex), JSON.stringify(best)); } catch { /* 저장 실패 시 이번 세션에만 적용 */ }
}
export function mergeBest(best: BestRecord | null, run: BestRecord): { best: BestRecord; improved: boolean } {
  if (!best) return { best: run, improved: true };
  const merged = { time: Math.min(best.time, run.time), deaths: Math.min(best.deaths, run.deaths) };
  return { best: merged, improved: merged.time < best.time || merged.deaths < best.deaths };
}
export class GameController {
  private levelIndex = 0;
  private world = new World(LEVELS[0]);
  private readonly renderer: CanvasRenderer;
  private readonly input = new InputManager(window);
  private readonly sound = new SoundPlayer(window);
  private readonly loop: GameLoop;
  private lastSnapshot = '';
  private paused = false;
  private bests: (BestRecord | null)[] = LEVELS.map((_, i) => loadBest(i));
  private newRecord = false;
  // #14 가짜 클리어 중 보여 줄 "진짜였다면"의 기록 화면(저장하지 않는다). world.fakeClear가 있을 때만 쓴다.
  private fakePreview: { best: BestRecord; improved: boolean } | null = null;
  constructor(
    canvas: HTMLCanvasElement,
    private readonly onSnapshot: (snapshot: HudSnapshot) => void,
    onError: (error: unknown) => void,
  ) {
    this.renderer = new CanvasRenderer(canvas);
    this.sound.muted = loadMuted();
    this.sound.volume = loadVolume();
    this.loop = new GameLoop((dt) => {
      const state = this.input.consume();
      if (state.toggleDebug) this.renderer.debug = !this.renderer.debug;
      if (state.togglePause) this.paused = !this.paused;
      if (state.toggleMute) this.setMuted(!this.sound.muted);
      if (state.nextLevel) this.advanceLevel();
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
        if (event === 'clear') {
          if (this.world.fakeClear) this.fakePreview = this.previewClear();
          else this.recordClear();
        }
        this.sound.play(event);
      }
      this.sound.updateMusic(!this.paused); // 일시정지(탭 숨김 포함) 중에는 배경 음악도 멈춘다
      this.publishSnapshot();
    }, (metrics) => this.renderer.render(this.world, metrics, this.paused), onError);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }
  private publishSnapshot(): void {
    // 가짜 클리어 중에는 진짜 클리어였다면 보였을 기록(최고 기록·NEW RECORD!)을 그대로 보여 준다.
    const preview = this.world.fakeClear ? this.fakePreview : null;
    const bests = preview ? this.bests.map((b, j) => (j === this.levelIndex ? preview.best : b)) : this.bests;
    const snapshot: HudSnapshot = {
      ...this.world.snapshot(), paused: this.paused, muted: this.sound.muted, volume: this.sound.volume,
      level: this.levelIndex + 1, levelCount: LEVELS.length, best: bests[this.levelIndex], bests, newRecord: preview ? preview.improved : this.newRecord,
    };
    const serialized = JSON.stringify(snapshot);
    if (serialized !== this.lastSnapshot) { this.lastSnapshot = serialized; this.onSnapshot(snapshot); }
  }
  // 탭이 백그라운드로 가면 강제로 일시 정지한다 — 보이지 않는 동안 쌓인 큰 dt가
  // 물리 스텝을 몰아서 처리하며 순간이동/관통을 일으키는 것을 막는다. 탭이 다시
  // 보여도 자동으로 재생하지 않고, 사용자가 P로 직접 재개하게 한다.
  // 숨겨진 탭에서는 RAF가 멈춰 다음 스텝의 updateMusic(false)가 오지 않는다 — 여기서 바로 음악을 끊어야
  // 이미 예약된 구간이 숨겨진 뒤에도 재생되지 않는다.
  private onVisibilityChange = (): void => {
    if (!document.hidden) return;
    this.paused = true;
    this.input.clearInput();
    this.sound.updateMusic(false);
    this.publishSnapshot();
  };
  // 키보드(R/P) 외에 화면의 버튼에서도 같은 동작을 호출할 수 있도록 공개한다 —
  // 터치/마우스로만 조작하는 사용자나 스크린 리더 사용자를 위한 접근성 통로.
  restart(): void { this.restartRun(); this.publishSnapshot(); }
  nextLevel(): void { this.advanceLevel(); this.publishSnapshot(); }
  private restartRun(): void { this.world.reset(); this.newRecord = false; }
  // 이번 런으로 클리어하면 될 기록. 다른 탭이 그사이 더 좋은 기록을 저장했을 수 있다 — 시작 시 읽은 기록만 믿으면 더 나쁜
  // 기록으로 덮어쓰고 NEW RECORD!까지 띄운다. 비교·저장 직전에 저장소를 다시 읽어 합친다.
  private previewClear(): { best: BestRecord; improved: boolean } {
    const snap = this.world.snapshot();
    const i = this.levelIndex;
    const stored = loadBest(i);
    const known = stored ? mergeBest(this.bests[i], stored).best : this.bests[i];
    return mergeBest(known, { time: snap.time, deaths: snap.runDeaths });
  }
  private recordClear(): void {
    const i = this.levelIndex;
    const { best, improved } = this.previewClear();
    this.bests = this.bests.map((b, j) => (j === i ? best : b));
    this.newRecord = improved;
    if (improved) saveBest(i, best);
  }
  // 클리어한 레벨에서만 다음 레벨로 넘어간다(버튼·N 키 공통). 마지막 레벨 뒤에는 레벨 1로 돌아가 처음부터 한다.
  // 새 레벨은 새 World로 시작하므로 시간·사망 수·체크포인트도 새로 센다. 다음 레벨 요청은 "이제 플레이하겠다"는
  // 명시적인 행동이므로, 클리어 후 정지해 둔 상태를 새 레벨로 물려주지 않고 재개한다.
  // 가짜 클리어(#14) 중이면 넘어가는 대신 깃발 아래 바닥이 꺼진다 — 진짜처럼 정지도 풀어 그대로 떨어지게 한다.
  private advanceLevel(): void {
    if (this.world.collapseFakeFloor()) { this.paused = false; return; }
    if (!this.world.cleared) return;
    this.levelIndex = (this.levelIndex + 1) % LEVELS.length;
    this.world = new World(LEVELS[this.levelIndex]);
    this.newRecord = false;
    this.paused = false;
  }
  togglePause(): void { this.paused = !this.paused; this.publishSnapshot(); }
  setTouch(action: TouchAction, pressed: boolean): void { this.input.setTouch(action, pressed); }
  toggleMute(): void { this.setMuted(!this.sound.muted); this.publishSnapshot(); }
  setVolume(volume: number): void { this.sound.volume = volume; saveVolume(this.sound.volume); this.publishSnapshot(); }
  private setMuted(muted: boolean): void { this.sound.muted = muted; saveMuted(muted); }
  start(): void { this.publishSnapshot(); this.loop.start(); }
  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.sound.dispose();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
