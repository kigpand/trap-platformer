import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas, type GameHandle } from './components/GameCanvas';
import type { GameSnapshot } from './game/world/World';
import './style.css';

export default function App() {
  const [snapshot, setSnapshot] = useState<GameSnapshot>({ x: 65, y: 350, grounded: false, deaths: 0, cleared: false, checkpoint: false });
  const [announcement, setAnnouncement] = useState('');
  const game = useRef<GameHandle>(null);
  const prevDeaths = useRef(snapshot.deaths);
  const onSnapshot = useCallback((next: GameSnapshot) => setSnapshot(next), []);

  // 스크린 리더 사용자에게도 사망/클리어 같은 중요한 전환을 알린다 — HUD는 시각적으로만
  // 갱신되고 캔버스 안의 상태 변화는 스크린 리더가 감지할 수 없다.
  useEffect(() => {
    if (snapshot.cleared) { setAnnouncement('레벨 클리어!'); return; }
    if (snapshot.deaths !== prevDeaths.current) {
      prevDeaths.current = snapshot.deaths;
      setAnnouncement(`사망 ${snapshot.deaths}번째 — ${snapshot.checkpoint ? '체크포인트에서' : '처음부터'} 다시 시작합니다`);
    }
  }, [snapshot.cleared, snapshot.deaths, snapshot.checkpoint]);

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
      <div className="controls">
        <button type="button" onClick={() => game.current?.togglePause()}>일시정지/재개 (P)</button>
        <button type="button" onClick={() => game.current?.restart()}>재시작 (R)</button>
      </div>
      <section className="hud" aria-label="게임 상태">
        <span>POSITION <b>{snapshot.x}, {snapshot.y}</b></span>
        <span>GROUNDED <b>{snapshot.grounded ? 'YES' : 'NO'}</b></span>
        <span>FALLS <b>{snapshot.deaths}</b></span>
        <span>CHECKPOINT <b>{snapshot.checkpoint ? 'SAVED' : 'NONE'}</b></span>
        <span>STATUS <b>{snapshot.cleared ? 'CLEAR!' : 'PLAYING'}</b></span>
      </section>
      <p className="help">← → / A D 이동 · Space / ↑ / W 점프 · R 재시작 · B 충돌 박스 표시 · P 일시정지</p>
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>
    </main>
  );
}
