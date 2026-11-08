import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas, type GameHandle } from './components/GameCanvas';
import { TouchControls } from './components/TouchControls';
import type { HudSnapshot } from './game/core/GameController';
import { rankDeaths, TAUNTS } from './game/rendering/taunts';
import './style.css';

// 완료 화면: 이번 판에서 그 레벨에 가장 많이 당한 함정.
function topKiller(byKind: Parameters<typeof rankDeaths>[0]): string {
  const top = rankDeaths(byKind)[0];
  return top ? `가장 많이 당한 함정 ${top.name} ×${top.count}` : '당한 함정 없음';
}

export default function App() {
  const [snapshot, setSnapshot] = useState<HudSnapshot>({
    x: 65, y: 350, grounded: false, deaths: 0, cleared: false, checkpoint: false, time: 0, runDeaths: 0, deathKind: null, runDeathsByKind: {},
    paused: false, muted: false, volume: 0.8, level: 1, levelCount: 1, best: null, bests: [], newRecord: false, levelDeaths: [],
  });
  const [announcement, setAnnouncement] = useState('');
  const game = useRef<GameHandle>(null);
  const prevDeaths = useRef(snapshot.deaths);
  const prevPaused = useRef(snapshot.paused);
  const prevLevel = useRef(snapshot.level);
  const prevCleared = useRef(snapshot.cleared);
  const allCleared = snapshot.cleared && snapshot.level === snapshot.levelCount;
  const deathRanking = rankDeaths(snapshot.runDeathsByKind);
  const onSnapshot = useCallback((next: HudSnapshot) => setSnapshot(next), []);

  // 스크린 리더 사용자에게도 사망/클리어 같은 중요한 전환을 알린다 — HUD는 시각적으로만
  // 갱신되고 캔버스 안의 상태 변화는 스크린 리더가 감지할 수 없다.
  useEffect(() => {
    // 레벨이 바뀌면 새 World라 사망 수가 0부터 다시 센다 — 사망 알림으로 오인하지 않게 기준값을 맞추고 레벨 시작을 알린다.
    if (snapshot.level !== prevLevel.current) {
      prevLevel.current = snapshot.level;
      prevDeaths.current = snapshot.deaths;
      prevCleared.current = snapshot.cleared;
      setAnnouncement(`레벨 ${snapshot.level} 시작`);
      return;
    }
    if (snapshot.cleared) {
      prevCleared.current = true;
      const record = snapshot.newRecord ? ' — 최고 기록 갱신!' : '';
      const next = snapshot.level === snapshot.levelCount ? ' 모든 레벨을 클리어했습니다.' : ' 다음 레벨 버튼이나 N 키로 계속합니다.';
      const top = rankDeaths(snapshot.runDeathsByKind)[0];
      const killer = top ? ` 가장 많이 당한 함정: ${top.name} ${top.count}회.` : '';
      setAnnouncement(`레벨 ${snapshot.level} 클리어! 기록 ${snapshot.time.toFixed(1)}초, 사망 ${snapshot.runDeaths}회${record}${killer}${next}`);
      return;
    }
    if (snapshot.deaths !== prevDeaths.current) {
      prevDeaths.current = snapshot.deaths;
      // 함정에 당했으면 캔버스와 같은 놀리는 문구를 덧붙인다(docs/game-design.md "놀리는 사망 메시지").
      const taunt = snapshot.deathKind ? ` ${TAUNTS[snapshot.deathKind]}` : '';
      setAnnouncement(`사망 ${snapshot.deaths}번째 — ${snapshot.checkpoint ? '체크포인트에서' : '처음부터'} 다시 시작합니다.${taunt}`);
      prevCleared.current = false;
      return;
    }
    // 클리어 표시가 사망·레벨 전환 없이 풀리면(가짜 클리어 #14에서 멀어짐·바닥 꺼짐, 클리어 후 재시작) 화면 변화와 같이 알린다.
    if (prevCleared.current) {
      prevCleared.current = false;
      setAnnouncement('다시 진행 중');
    }
  }, [snapshot.level, snapshot.levelCount, snapshot.cleared, snapshot.deaths, snapshot.checkpoint, snapshot.time, snapshot.runDeaths, snapshot.newRecord, snapshot.deathKind, snapshot.runDeathsByKind]);

  // 탭 전환으로 자동 정지될 때도 캔버스 오버레이만으로는 스크린 리더가 알 수 없다.
  useEffect(() => {
    if (snapshot.paused === prevPaused.current) return;
    prevPaused.current = snapshot.paused;
    setAnnouncement(snapshot.paused ? '일시정지됨 — P 또는 버튼으로 재개' : '게임 재개');
  }, [snapshot.paused]);

  return (
    <main className="app">
      <header>
        <span className="eyebrow">BROWSER TRAP PLATFORMER</span>
        <h1>TRAP RUNNER</h1>
        <p>보이는 대로 믿으면 떨어지는 2D 함정 플랫포머 — 함정 33종, 레벨 4개</p>
      </header>
      <div className="game-shell">
        <GameCanvas ref={game} onSnapshot={onSnapshot} />
      </div>
      {/* 당한 함정 통계: 진짜·가짜 클리어(#14) 모두 같은 스냅샷으로 그린다 — 가짜 클리어가 구분되면 안 된다. */}
      {snapshot.cleared && (
        <section className="death-stats" aria-label="이번 런에서 당한 함정">
          <h2>이번 런에서 당한 함정</h2>
          {deathRanking.length === 0 ? (
            <p>한 번도 안 당했어요!</p>
          ) : (
            <ol>
              {deathRanking.map((d) => <li key={d.kind}>{d.name} <b>×{d.count}</b></li>)}
            </ol>
          )}
        </section>
      )}
      {allCleared && (
        <section className="complete" aria-label="모든 레벨 클리어">
          <h2>모든 레벨 클리어!</h2>
          <ul>
            {snapshot.bests.map((best, i) => (
              <li key={i}>
                레벨 {i + 1} 최고 기록 <b>{best ? `${best.time.toFixed(1)}s / ${best.deaths} FALLS` : '—'}</b>
                {snapshot.levelDeaths[i] && <span className="level-killer">{topKiller(snapshot.levelDeaths[i])}</span>}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => game.current?.nextLevel()}>레벨 1부터 다시 (N)</button>
        </section>
      )}
      <TouchControls onTouch={(action, pressed) => game.current?.setTouch(action, pressed)} />
      <div className="controls">
        {snapshot.cleared && !allCleared && (
          <button type="button" className="next-level" onClick={() => game.current?.nextLevel()}>다음 레벨 (N)</button>
        )}
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
        <span>LEVEL <b>{snapshot.level} / {snapshot.levelCount}</b></span>
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
      <p className="help help-keys">← → / A D 이동 · Space / ↑ / W 점프 · R 재시작 · B 충돌 박스 표시 · P 일시정지 · M 음소거 · N 다음 레벨(클리어 후)</p>
      <p className="help help-keys">게임패드: 방향 패드 / 왼쪽 스틱 이동 · A / ↑ 점프 · Start 일시정지 · Select(Back) 재시작 · Y 다음 레벨(클리어 후)</p>
      <p className="help help-touch">◀ ▶ 버튼을 누르고 있는 동안 이동 · ▲ 점프 · 일시정지·재시작·음소거·다음 레벨은 화면의 버튼으로</p>
      <section className="about">
        <h2>게임 소개</h2>
        <p>
          Trap Runner는 설치 없이 브라우저에서 바로 하는 횡스크롤 함정 플랫포머입니다. 사라지는 땅, 투명 블록, 가짜 클리어 깃발,
          뒤를 따라오는 그림자처럼 처음 보면 당할 수밖에 없는 함정 33종이 레벨 4개에 숨어 있습니다. 죽으면 무엇에 당했는지 화면에
          표시되니, 다음 시도에서 피해 보세요. 체크포인트에서 다시 시작하고, 레벨마다 최고 기록(시간·떨어진 횟수)이 브라우저에 저장됩니다.
        </p>
      </section>
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>
    </main>
  );
}
