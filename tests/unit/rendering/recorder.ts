import type { Rect } from '../../../src/game/physics/AABB';

// fillRect를 그 시점의 fillStyle과 translate를 더한 실제 좌표로 기록하는 가짜 컨텍스트(happy-dom에는 Canvas 2D가 없다).
// fillText의 글자도 기록한다. { translate: false }면 translate를 무시해 그리기 함수가 넘긴 좌표(월드 좌표) 그대로 기록한다 —
// CanvasRenderer.test.ts는 카메라 이동과 상관없이 월드 좌표로 "어디를 어떤 색으로 칠했는지"를 확인한다.
export interface Fill { style: string; x: number; y: number; width: number; height: number }
export function recorder({ translate = true }: { translate?: boolean } = {}): { ctx: CanvasRenderingContext2D; fills: Fill[]; texts: string[] } {
  const fills: Fill[] = [];
  const texts: string[] = [];
  let offset = { x: 0, y: 0 };
  const stack: { x: number; y: number }[] = [];
  const state: Record<string | symbol, unknown> = { fillStyle: '' };
  const methods: Record<string, (...args: number[]) => void> = {
    fillRect: (x, y, width, height) => { fills.push({ style: String(state.fillStyle), x: x + offset.x, y: y + offset.y, width, height }); },
    translate: (x, y) => { if (translate) offset = { x: offset.x + x, y: offset.y + y }; },
    save: () => { stack.push(offset); },
    restore: () => { offset = stack.pop() ?? { x: 0, y: 0 }; },
  };
  const fillText = (text: string) => { texts.push(text); };
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key === 'fillText') return fillText;
      return typeof key === 'string' && key in methods ? methods[key] : key in target ? target[key] : () => {};
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  // 그리기 API 전체를 구현하지 않는 테스트용 대역이라 타입을 맞춰 넘긴다.
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, texts };
}
// 칠한 결과를 1px 격자로 펼친다(나중에 칠한 색이 이김). 그리는 순서·나눠 칠한 방식과 상관없이 보이는 그림만 비교한다.
export function pixels(fills: readonly Fill[], area: Rect): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of fills) {
    for (let y = Math.max(f.y, area.y); y < Math.min(f.y + f.height, area.y + area.height); y++) {
      for (let x = Math.max(f.x, area.x); x < Math.min(f.x + f.width, area.x + area.width); x++) out.set(`${x},${y}`, f.style);
    }
  }
  return out;
}
export const drawn = (draw: (ctx: CanvasRenderingContext2D) => void, area: Rect): Map<string, string> => {
  const { ctx, fills } = recorder();
  draw(ctx);
  return pixels(fills, area);
};

// 좌표를 origin 기준으로 옮긴다 — 다른 자리에 그린 두 그림을 모양만 비교할 때.
export function relative(map: Map<string, string>, origin: { x: number; y: number }): Map<string, string> {
  return new Map([...map].map(([k, c]) => { const [x, y] = k.split(',').map(Number); return [`${x - origin.x},${y - origin.y}`, c]; }));
}
