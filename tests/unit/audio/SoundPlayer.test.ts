// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundPlayer } from '../../../src/game/audio/SoundPlayer';

// happy-dom에는 Web Audio가 없으므로 연결 그래프와 게인 값만 기록하는 최소 모의 객체를 쓴다.
class FakeParam {
  constructor(public value: number) {}
  setValueAtTime(value: number): void { this.value = value; }
  setTargetAtTime(value: number): void { this.value = value; } // 페이드 곡선 대신 목표값만 기록한다
  exponentialRampToValueAtTime(): void {} // 페이드아웃 곡선은 이 테스트의 관심사가 아니다
}
class FakeNode {
  readonly outputs: FakeNode[] = [];
  readonly gain = new FakeParam(1);
  readonly frequency = new FakeParam(0);
  type = '';
  connect(node: FakeNode): FakeNode { this.outputs.push(node); return node; }
  start(): void {}
  stop(): void {}
}
class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  state = 'running';
  currentTime = 0;
  readonly destination = new FakeNode();
  readonly oscillators: FakeNode[] = [];
  constructor() { FakeAudioContext.last = this; }
  createGain(): FakeNode { return new FakeNode(); }
  createOscillator(): FakeNode { const osc = new FakeNode(); this.oscillators.push(osc); return osc; }
  resume(): Promise<void> { return Promise.resolve(); }
  close(): Promise<void> { return Promise.resolve(); }
}

// 노드에서 destination까지 게인이 0이 아닌 경로가 하나라도 있으면 소리가 들린다.
function isAudible(node: FakeNode, destination: FakeNode): boolean {
  if (node === destination) return true;
  if (node.gain.value === 0) return false;
  return node.outputs.some((next) => isAudible(next, destination));
}

function unlockedPlayer(): { player: SoundPlayer; ctx: FakeAudioContext } {
  vi.stubGlobal('AudioContext', FakeAudioContext);
  const player = new SoundPlayer(window);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); // 사용자 제스처로 컨텍스트 준비
  const ctx = FakeAudioContext.last;
  if (!ctx) throw new Error('AudioContext was not created on the first keydown');
  return { player, ctx };
}

describe('SoundPlayer', () => {
  afterEach(() => { vi.unstubAllGlobals(); FakeAudioContext.last = null; });

  it('plays the clear jingle through to the destination when not muted', () => {
    const { player, ctx } = unlockedPlayer();
    player.play('clear');
    expect(ctx.oscillators).toHaveLength(4);
    expect(ctx.oscillators.every((osc) => isAudible(osc, ctx.destination))).toBe(true);
    player.dispose();
  });

  it('silences notes that are already playing or scheduled when muted mid-sound', () => {
    // 코덱스 리뷰: muted가 새 play()만 막아서, 클리어 음 도중 M을 누르면 HUD는 SOUND OFF인데
    // 이미 예약된 남은 음이 계속 재생됐다.
    const { player, ctx } = unlockedPlayer();
    player.play('clear');
    player.muted = true;
    expect(ctx.oscillators.some((osc) => isAudible(osc, ctx.destination))).toBe(false);
    player.muted = false;
    expect(ctx.oscillators.every((osc) => isAudible(osc, ctx.destination))).toBe(true);
    player.dispose();
  });

  it('stays silent if muted before the audio context is created', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const player = new SoundPlayer(window);
    player.muted = true;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    player.play('jump');
    expect(FakeAudioContext.last?.oscillators).toHaveLength(0);
    player.dispose();
  });

  it('applies the volume to the master gain, and mute still overrides it', () => {
    const { player, ctx } = unlockedPlayer();
    player.volume = 0.5;
    player.play('jump');
    const master = ctx.oscillators[0].outputs[0].outputs[0];
    expect(master.gain.value).toBe(0.5);
    player.muted = true;
    expect(master.gain.value).toBe(0);
    player.muted = false;
    expect(master.gain.value).toBe(0.5); // 음소거를 풀면 이전 음량으로 돌아온다
    player.dispose();
  });

  it('schedules background music ahead while playing and silences it when stopped', () => {
    const { player, ctx } = unlockedPlayer();
    player.updateMusic(true);
    const scheduled = ctx.oscillators.length;
    expect(scheduled).toBeGreaterThan(0);
    expect(ctx.oscillators.every((osc) => isAudible(osc, ctx.destination))).toBe(true);
    player.updateMusic(true); // 시간이 흐르지 않았으면 이미 예약한 구간을 다시 예약하지 않는다
    expect(ctx.oscillators).toHaveLength(scheduled);
    player.updateMusic(false); // 일시정지: 이미 예약된 음까지 들리지 않아야 한다
    expect(ctx.oscillators.some((osc) => isAudible(osc, ctx.destination))).toBe(false);
    player.dispose();
  });

  it('does not schedule music while muted', () => {
    const { player, ctx } = unlockedPlayer();
    player.muted = true;
    player.updateMusic(true);
    expect(ctx.oscillators).toHaveLength(0);
    player.dispose();
  });

  it('does not burst out a backlog of notes after a long stall', () => {
    const { player, ctx } = unlockedPlayer();
    player.updateMusic(true);
    const before = ctx.oscillators.length;
    ctx.currentTime += 10; // 10초 동안 호출되지 않았다고 가정
    player.updateMusic(true);
    // 10초 분량(약 47스텝)을 따라잡지 않고 앞으로의 짧은 구간만 예약한다
    expect(ctx.oscillators.length - before).toBeLessThanOrEqual(before + 2);
    player.dispose();
  });
});

