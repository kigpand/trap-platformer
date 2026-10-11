import { useCallback, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import type { GameSnapshot } from './game/world/World';
import './style.css';
export default function App() {
  const [snapshot, setSnapshot] = useState<GameSnapshot>({ x: 65, y: 350, grounded: false, deaths: 0, cleared: false });
  const onSnapshot = useCallback((next: GameSnapshot) => setSnapshot(next), []);
  return <main className="app"><header><span className="eyebrow">CANVAS 2D / PROTOTYPE 0.1</span><h1>TRAP RUNNER</h1><p>오리지널 함정 플랫포머 — 엔진 기반 테스트 레벨</p></header><div className="game-shell"><GameCanvas onSnapshot={onSnapshot}/></div><section className="hud" aria-label="게임 상태"><span>POSITION <b>{snapshot.x}, {snapshot.y}</b></span><span>GROUNDED <b>{snapshot.grounded ? 'YES' : 'NO'}</b></span><span>FALLS <b>{snapshot.deaths}</b></span><span>STATUS <b>{snapshot.cleared ? 'CLEAR!' : 'PLAYING'}</b></span></section><p className="help">← → / A D 이동 · Space / ↑ / W 점프 · R 재시작 · B 충돌 박스 표시</p></main>;
}
