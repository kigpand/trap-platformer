import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas, type GameHandle } from './components/GameCanvas';
import { TouchControls } from './components/TouchControls';
import type { HudSnapshot } from './game/core/GameController';
import './style.css';

export default function App() {
  const [snapshot, setSnapshot] = useState<HudSnapshot>({
    x: 65, y: 350, grounded: false, deaths: 0, cleared: false, checkpoint: false, time: 0, runDeaths: 0,
    paused: false, muted: false, volume: 0.8, best: null, newRecord: false,
  });
  const [announcement, setAnnouncement] = useState('');
  const game = useRef<GameHandle>(null);
  const prevDeaths = useRef(snapshot.deaths);
  const prevPaused = useRef(snapshot.paused);
  const onSnapshot = useCallback((next: HudSnapshot) => setSnapshot(next), []);

  // 스크린 리더 사용자에게도 사망/클리어 같은 중요한 전환을 알린다 — HUD는 시각적으로만
  // 갱신되고 캔버스 안의 상태 변화는 스크린 리더가 감지할 수 없다.
  useEffect(() => {
    if (snapshot.cleared) {
      const record = snapshot.newRecord ? ' — 최고 기록 갱신!' : '';
      setAnnouncement(`레벨 클리어! 기록 ${snapshot.time.toFixed(1)}초, 사망 ${snapshot.runDeaths}회${record}`);
      return;
    }
    if (snapshot.deaths !== prevDeaths.current) {
      prevDeaths.current = snapshot.deaths;
      setAnnouncement(`사망 ${snapshot.deaths}번째 — ${snapshot.checkpoint ? '체크포인트에서' : '처음부터'} 다시 시작합니다`);
    }
  }, [snapshot.cleared, snapshot.deaths, snapshot.checkpoint, snapshot.time, snapshot.runDeaths, snapshot.newRecord]);

  // 탭 전환으로 자동 정지될 때도 캔버스 오버레이만으로는 스크린 리더가 알 수 없다.
  useEffect(() => {
    if (snapshot.paused === prevPaused.current) return;
    prevPaused.current = snapshot.paused;
    setAnnouncement(snapshot.paused ? '일시정지됨 — P 또는 버튼으로 재개' : '게임 재개');
  }, [snapshot.paused]);

  return (
    <main className="app">
      <header>
        <span className="eyebrow">CANVAS 2D / PROTOTYPE 0.1</span>
        <h1>TRAP RUNNER</h1>
        <p>오리지널 함정 플랫포머 — 엔진 기반 테스트 레벨</p>
      </header>
      <div className="game-shell">
        <GameCanvas ref={game} onSnapshot={onSnapshot} />
      </div>
      <TouchControls onTouch={(action, pressed) => game.current?.setTouch(action, pressed)} />
      <div className="controls">
        <button type="button" aria-pressed={snapshot.paused} onClick={() => game.current?.togglePause()}>일시정지/재개 (P)</button>
        <button type="button" onClick={() => game.current?.restart()}>재시작 (R)</button>
        <button type="button" aria-pressed={snapshot.muted} onClick={() => game.current?.toggleMute()}>음소거 (M)</button>
        <label className="volume">
          음량 {Math.round(snapshot.volume * 100)}%
          {/* 마우스·터치로 조절한 뒤 포커스가 남으면 방향키가 슬라이더로 가서 이동이 막힌다 — 손을 떼면 포커스를 놓는다.
              키보드로 탭해 들어온 경우엔 방향키 조절을 그대로 쓸 수 있다. */}
          <input
            type="range" min={0} max={100} step={5}
            value={Math.round(snapshot.volume * 100)}
            onChange={(event) => game.current?.setVolume(Number(event.currentTarget.value) / 100)}
            onPointerUp={(event) => event.currentTarget.blur()}
          />
        </label>
      </div>
      <section className="hud" aria-label="게임 상태">
        <span>POSITION <b>{snapshot.x}, {snapshot.y}</b></span>
        <span>GROUNDED <b>{snapshot.grounded ? 'YES' : 'NO'}</b></span>
        <span>FALLS <b>{snapshot.deaths}</b></span>
        <span>CHECKPOINT <b>{snapshot.checkpoint ? 'SAVED' : 'NONE'}</b></span>
        <span>STATUS <b>{snapshot.paused ? 'PAUSED' : snapshot.cleared ? (snapshot.newRecord ? 'NEW RECORD!' : 'CLEAR!') : 'PLAYING'}</b></span>
        <span>TIME <b>{snapshot.time.toFixed(1)}s</b></span>
        <span>BEST <b>{snapshot.best ? `${snapshot.best.time.toFixed(1)}s / ${snapshot.best.deaths} FALLS` : '—'}</b></span>
        <span>SOUND <b>{snapshot.muted ? 'OFF' : 'ON'}</b></span>
      </section>
      {/* 입력 방식에 맞는 안내만 보인다(style.css의 pointer: coarse 미디어 쿼리) */}
      <p className="help help-keys">← → / A D 이동 · Space / ↑ / W 점프 · R 재시작 · B 충돌 박스 표시 · P 일시정지 · M 음소거</p>
      <p className="help help-touch">◀ ▶ 버튼을 누르고 있는 동안 이동 · ▲ 점프 · 일시정지·재시작·음소거는 화면의 버튼으로</p>
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>
    </main>
  );
}
