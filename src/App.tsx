import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas, type GameHandle } from './components/GameCanvas';
import { TouchControls } from './components/TouchControls';
import { ClockIcon, FlagIcon, PauseIcon, PlayIcon, RestartIcon, SkullIcon, SoundIcon, TrophyIcon } from './components/Icons';
import type { HudSnapshot } from './game/core/GameController';
import { rankDeaths, TAUNTS } from './game/rendering/taunts';
import './style.css';

// 완료 화면: 이번 판에서 그 레벨에 가장 많이 당한 함정.
function topKiller(byKind: Parameters<typeof rankDeaths>[0]): string {
  const top = rankDeaths(byKind)[0];
  return top ? `가장 많이 당한 함정 ${top.name} ×${top.count}` : '당한 함정 없음';
}

// 클리어·완료 창의 "이번 런에서 당한 함정". 많이 당한 순서.
function DeathRanking({ ranking }: { ranking: ReturnType<typeof rankDeaths> }) {
  return (
    <section className="death-stats" aria-label="이번 런에서 당한 함정">
      <h3>이번 런에서 당한 함정</h3>
      {ranking.length === 0 ? (
        <p>한 번도 안 당했어요!</p>
      ) : (
        <ol>
          {ranking.map((d) => <li key={d.kind}>{d.name} <b>×{d.count}</b></li>)}
        </ol>
      )}
    </section>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<HudSnapshot>({
    debugPlayer: null, debugDeaths: null, deaths: 0, cleared: false, checkpoint: false, time: 0, runDeaths: 0, deathKind: null, runDeathsByKind: {},
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
    // 클리어 알림은 클리어되는 순간 한 번만 낸다. 클리어 뒤에도 플레이어가 움직여 스냅샷이 계속 오는데(runDeathsByKind는 매번 새 객체라
    // 이 effect도 매번 돈다), 다시 내면 사이에 온 일시정지·재개 알림을 덮어써 같은 클리어 문장이 또 읽힌다.
    if (snapshot.cleared) {
      if (prevCleared.current) return;
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
        {/* 게임 화면 위에 겹치는 HUD와 창(2026-11-24 프로젝트 오너 결정 — 웹 페이지가 아니라 게임처럼 보이게). 글자 라벨은
            스크린 리더용으로 남겨 두고, 화면에는 아이콘과 값만 보인다. */}
        <div className="game-ui">
          <section className="hud" aria-label="게임 상태">
            <div className="hud-group">
              <span className="hud-stat hud-level"><span className="hud-label">LEVEL </span><b>{snapshot.level} / {snapshot.levelCount}</b></span>
              <span className="hud-stat" title="떨어진 횟수"><SkullIcon /><span className="visually-hidden">FALLS </span><b>{snapshot.deaths}</b></span>
              <span className={`hud-stat hud-icon-only${snapshot.checkpoint ? ' is-on' : ''}`} title={snapshot.checkpoint ? '체크포인트 저장됨' : '체크포인트 없음'}><FlagIcon /><span className="visually-hidden">CHECKPOINT {snapshot.checkpoint ? 'SAVED' : 'NONE'}</span></span>
              {snapshot.debugPlayer && (
                <>
                  <span className="hud-stat hud-debug">POSITION <b>{snapshot.debugPlayer.x}, {snapshot.debugPlayer.y}</b></span>
                  <span className="hud-stat hud-debug">GROUNDED <b>{snapshot.debugPlayer.grounded ? 'YES' : 'NO'}</b></span>
                </>
              )}
            </div>
            <div className="hud-group">
              <span className="hud-stat" title="이번 런 시간"><ClockIcon /><span className="visually-hidden">TIME </span><b>{snapshot.time.toFixed(1)}s</b></span>
              <span className="hud-stat" title="최고 기록"><TrophyIcon /><span className="visually-hidden">BEST </span><b>{snapshot.best ? `${snapshot.best.time.toFixed(1)}s / ${snapshot.best.deaths} FALLS` : '—'}</b></span>
              <button type="button" className="hud-button" aria-label="일시정지/재개 (P)" aria-pressed={snapshot.paused} title="일시정지 (P)" onClick={() => game.current?.togglePause()}>
                {snapshot.paused ? <PlayIcon /> : <PauseIcon />}
              </button>
              <button type="button" className="hud-button" aria-label="재시작 (R)" title="재시작 (R)" onClick={() => game.current?.restart()}><RestartIcon /></button>
              <button type="button" className="hud-button" aria-label="음소거 (M)" aria-pressed={snapshot.muted} title="음소거 (M)" onClick={() => game.current?.toggleMute()}>
                <SoundIcon muted={snapshot.muted} />
              </button>
            </div>
          </section>
          {/* 일시정지 창: 클리어 화면이 떠 있으면 그 창이 우선이다(정지 중 클리어 창은 그대로 보인다). */}
          {snapshot.paused && !snapshot.cleared && (
            <div className="overlay">
              <section className="panel" role="dialog" aria-label="일시정지">
                <h2>일시정지</h2>
                <div className="panel-actions">
                  <button type="button" className="primary" onClick={() => game.current?.togglePause()}>계속하기 (P)</button>
                  <button type="button" onClick={() => game.current?.restart()}>처음부터 다시 (R)</button>
                  <button type="button" onClick={() => game.current?.toggleMute()}>{snapshot.muted ? '소리 켜기 (M)' : '소리 끄기 (M)'}</button>
                </div>
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
              </section>
            </div>
          )}
          {/* 클리어 창: 진짜·가짜 클리어(#14) 모두 같은 스냅샷으로 그린다 — 가짜 클리어가 구분되면 안 된다. */}
          {snapshot.cleared && !allCleared && (
            <div className="overlay">
              <section className="panel" role="dialog" aria-label="레벨 클리어">
                <p className="panel-kicker">LEVEL {snapshot.level}</p>
                <h2>{snapshot.newRecord ? 'NEW RECORD!' : 'CLEAR!'}</h2>
                <dl className="result">
                  <div><dt><ClockIcon />시간</dt><dd>{snapshot.time.toFixed(1)}s</dd></div>
                  <div><dt><SkullIcon />떨어짐</dt><dd>{snapshot.runDeaths}</dd></div>
                  <div><dt><TrophyIcon />최고</dt><dd>{snapshot.best ? `${snapshot.best.time.toFixed(1)}s / ${snapshot.best.deaths}` : '—'}</dd></div>
                </dl>
                <DeathRanking ranking={deathRanking} />
                <div className="panel-actions">
                  <button type="button" className="primary" onClick={() => game.current?.nextLevel()}>다음 레벨 (N)</button>
                </div>
              </section>
            </div>
          )}
          {allCleared && (
            <div className="overlay">
              <section className="panel panel-wide" role="dialog" aria-label="모든 레벨 클리어">
                <p className="panel-kicker">ALL CLEAR</p>
                <h2>모든 레벨 클리어!</h2>
                <ul className="level-records">
                  {snapshot.bests.map((best, i) => (
                    <li key={i}>
                      <span>레벨 {i + 1}</span>
                      <b>{best ? `${best.time.toFixed(1)}s / ${best.deaths} FALLS` : '—'}</b>
                      {snapshot.levelDeaths[i] && <span className="level-killer">{topKiller(snapshot.levelDeaths[i])}</span>}
                    </li>
                  ))}
                </ul>
                <DeathRanking ranking={deathRanking} />
                <div className="panel-actions">
                  <button type="button" className="primary" onClick={() => game.current?.nextLevel()}>레벨 1부터 다시 (N)</button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
      <TouchControls onTouch={(action, pressed) => game.current?.setTouch(action, pressed)} />
      {/* 누적 사망 기록(B를 켰을 때만): 새로고침·새 런에도 남는, 이 레벨의 원인별 사망 수 — 배치 판단용(docs/game-design.md "기록") */}
      {snapshot.debugDeaths && (
        <section className="death-stats debug-deaths" aria-label="누적 사망 기록">
          <h2>누적 사망 기록 — 레벨 {snapshot.level}, {snapshot.debugDeaths.total}회</h2>
          {snapshot.debugDeaths.total === 0 ? (
            <p>아직 기록이 없어요.</p>
          ) : (
            <ol>
              {rankDeaths(snapshot.debugDeaths.kinds).map((d) => <li key={d.kind}>{d.name} <b>×{d.count}</b></li>)}
            </ol>
          )}
          <button type="button" onClick={() => game.current?.clearDeathLog()}>누적 사망 기록 지우기 (모든 레벨)</button>
        </section>
      )}
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
