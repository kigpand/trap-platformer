import type { Rect } from '../physics/AABB';

// 땅·블록의 픽셀 질감. 무늬는 월드 좌표로만 정한다(사각형의 가장자리·크기와 상관없음) — 그래야 이어 붙인 바닥에 이음매가
// 보이지 않고, 같은 자리를 그리면 일반 바닥이든 바닥으로 위장한 함정(가짜 안전지대·사라지는 땅·숨겨진 블록 등)이든
// 똑같이 그려져 위장이 깨지지 않는다(docs/traps-spec.md의 텔레그래프). 같은 이유로 테두리·모서리 음영은 넣지 않는다.
// view는 화면에 보이는 월드 범위로, 그 밖의 무늬는 그리지 않는다. 움직이는 바닥(도망가는 발판)은 slide에 처음 자리에서
// 움직인 만큼을 넘겨, 무늬가 바닥 위에서 미끄러지지 않고 같이 움직이게 한다(멈춰 있을 때는 주변 바닥과 같은 무늬).
export const GROUND_FILL = '#627e55';
export const GROUND_TOP = '#99c577';
const GROUND_TOP_HEIGHT = 8;
const GRASS_SHADE = '#7fa35f'; // 풀과 흙 사이 줄
const GRASS_LIGHT = '#bfe39a'; // 풀 윗면의 밝은 점
const SOIL_SPECK = '#4c6542'; // 흙 속 작은 돌
export const BLOCK_FILL = '#8a6d4b';
export const BLOCK_TOP = '#b08a5e';
const BLOCK_MORTAR = '#6f5639'; // 벽돌 줄눈
const CELL = 16;
const BRICK_W = 20;
const BRICK_H = 10;

export interface View { x: number; width: number; height: number }
const NO_SLIDE = { x: 0, y: 0 };

// 칸 좌표로 정해지는 0~255의 고정 값(무작위 대신 — 매 프레임 같은 무늬, 테스트에서 재현).
function hash(cx: number, cy: number): number {
  let h = (cx * 374761393 + cy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) & 255;
}

// r 안쪽으로 잘라 칠한다(잘린 부분이 없으면 그리지 않음).
function fillClipped(ctx: CanvasRenderingContext2D, r: Rect, x: number, y: number, w: number, h: number): void {
  const x0 = Math.max(x, r.x), y0 = Math.max(y, r.y);
  const x1 = Math.min(x + w, r.x + r.width), y1 = Math.min(y + h, r.y + r.height);
  if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

// 보이는 부분(가로는 view, 세로는 캔버스 높이까지)만 남긴 사각형. 무늬 칸 수를 화면 크기로 묶는다.
function visiblePart(r: Rect, view: View): Rect | null {
  const x0 = Math.max(r.x, view.x), x1 = Math.min(r.x + r.width, view.x + view.width);
  const y1 = Math.min(r.y + r.height, view.height);
  return x1 > x0 && y1 > r.y ? { x: x0, y: r.y, width: x1 - x0, height: y1 - r.y } : null;
}

export function drawGround(ctx: CanvasRenderingContext2D, rect: Rect, view: View, slide: { x: number; y: number } = NO_SLIDE): void {
  ctx.fillStyle = GROUND_FILL; ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.fillStyle = GROUND_TOP; ctx.fillRect(rect.x, rect.y, rect.width, Math.min(GROUND_TOP_HEIGHT, rect.height));
  const r = { ...rect, x: rect.x - slide.x, y: rect.y - slide.y }; // 무늬는 처음 자리 기준으로 계산하고 slide만큼 옮겨 그린다
  const v = visiblePart(r, { ...view, x: view.x - slide.x, height: view.height - slide.y });
  if (!v) return;
  const moved = slide.x !== 0 || slide.y !== 0;
  if (moved) { ctx.save(); ctx.translate(slide.x, slide.y); }
  const firstX = Math.floor(v.x / CELL), lastX = Math.floor((v.x + v.width - 1) / CELL);
  ctx.fillStyle = GRASS_SHADE;
  for (let cx = firstX; cx <= lastX; cx++) {
    const k = hash(cx, 0);
    fillClipped(ctx, r, cx * CELL, r.y + GROUND_TOP_HEIGHT - 2, CELL, 2 + (k % 3 === 0 ? 2 : 0)); // 흙 쪽으로 늘어진 풀
  }
  ctx.fillStyle = GRASS_LIGHT;
  for (let cx = firstX; cx <= lastX; cx++) {
    const k = hash(cx, 1);
    if (k % 2 === 0) fillClipped(ctx, r, cx * CELL + (k % 12), r.y + 1, 2, 2);
  }
  ctx.fillStyle = SOIL_SPECK;
  const firstY = Math.floor((r.y + GROUND_TOP_HEIGHT + 4) / CELL), lastY = Math.floor((v.y + v.height - 1) / CELL);
  for (let cy = firstY; cy <= lastY; cy++) {
    for (let cx = firstX; cx <= lastX; cx++) {
      const k = hash(cx, cy);
      if (k % 3 !== 0) continue;
      const y = cy * CELL + ((k >> 4) % 10);
      if (y < r.y + GROUND_TOP_HEIGHT + 4) continue; // 풀 바로 아래는 비워 둔다
      fillClipped(ctx, r, cx * CELL + ((k >> 2) % 12), y, k % 2 === 0 ? 4 : 2, 2);
    }
  }
  if (moved) ctx.restore();
}

// 공중 블록(투명 블록이 나타난 뒤·떨어지는 천장·가짜 벽·내려오는 천장). 블록은 하나씩 떨어져 있고 움직이기도 하므로
// 벽돌 무늬는 블록 자신의 왼쪽 위 기준이다(같은 크기면 진짜 블록과 가짜 벽이 똑같다). edge는 밝은 테두리 쪽 — 내려오는 천장은 아랫면.
export function drawBlock(ctx: CanvasRenderingContext2D, r: Rect, view: View, edge: 'top' | 'bottom' = 'top'): void {
  ctx.fillStyle = BLOCK_FILL; ctx.fillRect(r.x, r.y, r.width, r.height);
  const v = visiblePart(r, view);
  if (v) {
    ctx.fillStyle = BLOCK_MORTAR;
    const rows = Math.ceil((v.y + v.height - r.y) / BRICK_H);
    for (let row = 0; row < rows; row++) {
      const y = r.y + row * BRICK_H;
      fillClipped(ctx, r, v.x, y + BRICK_H - 2, v.width, 2); // 가로 줄눈
      const offset = row % 2 === 0 ? 0 : BRICK_W / 2; // 엇갈려 쌓기
      for (let x = r.x + offset + BRICK_W * Math.max(0, Math.floor((v.x - r.x - offset) / BRICK_W)); x < v.x + v.width; x += BRICK_W) fillClipped(ctx, r, x, y, 2, BRICK_H - 2);
    }
  }
  ctx.fillStyle = BLOCK_TOP;
  const h = Math.min(4, r.height);
  ctx.fillRect(r.x, edge === 'top' ? r.y : r.y + r.height - h, r.width, h);
}

// 파이프(지형지물): 청회색 금속 관에 윗부분 테두리 띠와 볼트. 무늬는 파이프 자신의 왼쪽 위 기준이라 같은 크기면 어디서든 똑같이
// 그려진다. 모든 칠은 충돌 사각형 안에만 한다 — 테두리 띠가 몸통보다 튀어나와 보이면 설 수 있는 곳이 그림과 달라진다.
export const PIPE_FILL = '#5b7f8f';
export const PIPE_CAP = '#7aa3b2';
const PIPE_LIGHT = '#a9c9d3'; // 왼쪽 반사광
const PIPE_SHADE = '#3e5f6b'; // 오른쪽 그늘·띠 아래 줄
const PIPE_BOLT = '#2c434c';
const PIPE_CAP_HEIGHT = 14;
export function drawPipe(ctx: CanvasRenderingContext2D, r: Rect): void {
  const cap = Math.min(PIPE_CAP_HEIGHT, r.height);
  ctx.fillStyle = PIPE_FILL; ctx.fillRect(r.x, r.y, r.width, r.height);
  ctx.fillStyle = PIPE_SHADE; fillClipped(ctx, r, r.x + r.width - 10, r.y, 6, r.height);
  ctx.fillStyle = PIPE_CAP; ctx.fillRect(r.x, r.y, r.width, cap);
  ctx.fillStyle = PIPE_SHADE; fillClipped(ctx, r, r.x, r.y + cap, r.width, 2);
  ctx.fillStyle = PIPE_LIGHT;
  fillClipped(ctx, r, r.x + 6, r.y + 2, 4, cap - 4);
  fillClipped(ctx, r, r.x + 8, r.y + cap + 2, 4, r.height - cap - 2);
  ctx.fillStyle = PIPE_BOLT;
  for (let x = r.x + 14; x + 2 <= r.x + r.width - 12; x += 12) fillClipped(ctx, r, x, r.y + cap / 2 - 1, 2, 2);
}

// 움직임을 바꾸는 지형지물(함정 아님 — 보이는 그대로 동작하므로 바닥과 구분되게 그린다). 모두 판정 사각형 안에만 칠한다.
// 트램펄린: 바닥 윗면에 놓인 보라색 매트와 양쪽 다리.
export const TRAMPOLINE_MAT = '#c084fc';
const TRAMPOLINE_FRAME = '#475569';
const TRAMPOLINE_SPRING = '#cbd5e1';
export function drawTrampoline(ctx: CanvasRenderingContext2D, t: Rect): void {
  const h = Math.min(16, t.height);
  ctx.fillStyle = '#101729'; fillClipped(ctx, t, t.x + 4, t.y + 5, t.width - 8, h - 7); // 매트 아래 빈 공간
  ctx.fillStyle = TRAMPOLINE_SPRING; // 지그재그 스프링 두 개
  for (const sx of [t.x + 8, t.x + t.width - 12]) for (let k = 0; k < 4; k++) fillClipped(ctx, t, sx + (k % 2 === 0 ? 0 : 2), t.y + 6 + k * 2, 2, 2);
  ctx.fillStyle = TRAMPOLINE_FRAME;
  fillClipped(ctx, t, t.x, t.y + 3, 4, h - 3);
  fillClipped(ctx, t, t.x + t.width - 4, t.y + 3, 4, h - 3);
  fillClipped(ctx, t, t.x, t.y + h - 2, t.width, 2);
  ctx.fillStyle = TRAMPOLINE_MAT;
  fillClipped(ctx, t, t.x, t.y, t.width, 5);
}
// 컨베이어 벨트: 바닥 윗면을 덮는 회색 벨트와 흐르는 방향의 화살(">" 또는 "<") 무늬. 무늬는 월드 좌표 기준이고, phase(렌더링 전용 시간)만큼 흐른다.
export const BELT_FILL = '#3f4a5c';
export const BELT_ARROW = '#a3b1c6';
const BELT_HEIGHT = 10;
const BELT_CELL = 16;
const CHEVRON: readonly (readonly [number, number])[] = [[0, 1], [2, 3], [4, 4], [2, 5], [0, 7]];
export function drawConveyor(ctx: CanvasRenderingContext2D, r: Rect, speed: number, phase: number, view: View): void {
  const h = Math.min(BELT_HEIGHT, r.height);
  ctx.fillStyle = BELT_FILL; ctx.fillRect(r.x, r.y, r.width, h);
  const v = visiblePart(r, view);
  if (!v) return;
  const right = speed >= 0;
  const shift = ((phase * speed) % BELT_CELL + BELT_CELL) % BELT_CELL;
  const belt = { ...r, height: h };
  ctx.fillStyle = BELT_ARROW;
  for (let x = Math.floor((v.x - shift) / BELT_CELL) * BELT_CELL + shift; x < v.x + v.width; x += BELT_CELL) {
    for (const [dx, dy] of CHEVRON) fillClipped(ctx, belt, x + (right ? dx : 4 - dx), r.y + dy, 2, 2);
  }
}
// 진흙: 바닥 윗면을 덮는 갈색 진흙과 어두운 웅덩이 점. 무늬는 월드 좌표 칸 해시.
export const MUD_FILL = '#6b4f2a';
const MUD_SPOT = '#4a3620';
export function drawMud(ctx: CanvasRenderingContext2D, r: Rect, view: View): void {
  const h = Math.min(12, r.height);
  ctx.fillStyle = MUD_FILL; ctx.fillRect(r.x, r.y, r.width, h);
  const v = visiblePart(r, view);
  if (!v) return;
  ctx.fillStyle = MUD_SPOT;
  for (let cx = Math.floor(v.x / CELL); cx <= Math.floor((v.x + v.width - 1) / CELL); cx++) {
    const k = hash(cx, 7);
    if (k % 2 === 0) fillClipped(ctx, { ...r, height: h }, cx * CELL + (k % 10), r.y + 3 + ((k >> 3) % 6), 4, 2);
  }
}
