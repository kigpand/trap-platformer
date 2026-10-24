import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { GameController, type HudSnapshot } from '../game/core/GameController';
import type { TouchAction } from '../game/core/InputManager';
export interface GameHandle { restart(): void; togglePause(): void; toggleMute(): void; setTouch(action: TouchAction, pressed: boolean): void }
export const GameCanvas = forwardRef<GameHandle, { onSnapshot: (s: HudSnapshot) => void }>(
  function GameCanvas({ onSnapshot }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const controller = useRef<GameController | null>(null);
    // 게임 루프(RAF) 안의 예외는 React 렌더 밖이라 ErrorBoundary가 잡지 못한다 —
    // 상태 갱신 함수 안에서 다시 던져 렌더 단계 오류로 바꿔 상위 ErrorBoundary로 보낸다.
    const [, setCrash] = useState<null>(null);
    useEffect(() => {
      const node = canvas.current;
      if (!node) return;
      const game = new GameController(node, onSnapshot, (error) => setCrash(() => { throw error; }));
      controller.current = game;
      game.start();
      return () => { controller.current = null; game.dispose(); };
    }, [onSnapshot]);
    useImperativeHandle(ref, () => ({
      restart: () => controller.current?.restart(),
      togglePause: () => controller.current?.togglePause(),
      toggleMute: () => controller.current?.toggleMute(),
      setTouch: (action, pressed) => controller.current?.setTouch(action, pressed),
    }), []);
    return <canvas ref={canvas} aria-label="2D 횡스크롤 게임 화면" width={960} height={540} />;
  },
);
