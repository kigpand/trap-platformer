import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { GameController } from '../game/core/GameController';
import type { GameSnapshot } from '../game/world/World';
export interface GameHandle { restart(): void; togglePause(): void }
export const GameCanvas = forwardRef<GameHandle, { onSnapshot: (s: GameSnapshot) => void }>(
  function GameCanvas({ onSnapshot }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const controller = useRef<GameController | null>(null);
    useEffect(() => {
      const node = canvas.current;
      if (!node) return;
      const game = new GameController(node, onSnapshot);
      controller.current = game;
      game.start();
      return () => { controller.current = null; game.dispose(); };
    }, [onSnapshot]);
    useImperativeHandle(ref, () => ({
      restart: () => controller.current?.restart(),
      togglePause: () => controller.current?.togglePause(),
    }), []);
    return <canvas ref={canvas} aria-label="2D 횡스크롤 게임 화면" width={960} height={540} />;
  },
);
