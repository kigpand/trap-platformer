import { useEffect, useRef } from 'react';
import { GameController } from '../game/core/GameController';
import type { GameSnapshot } from '../game/world/World';
export function GameCanvas({ onSnapshot }: { onSnapshot: (s: GameSnapshot) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const node = canvas.current; if (!node) return; const game = new GameController(node, onSnapshot); game.start(); return () => game.dispose(); }, [onSnapshot]);
  return <canvas ref={canvas} aria-label="2D 횡스크롤 게임 화면" width={960} height={540} />;
}
